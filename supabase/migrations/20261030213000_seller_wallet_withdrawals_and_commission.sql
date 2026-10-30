begin;

-- Snapshot the rate per verified order; subsequent setting changes never rewrite a past order.
alter table public.orders
  add column if not exists commission_rate numeric(5,2),
  add column if not exists commission_amount numeric(12,2);

update public.orders
set commission_amount = coalesce(platform_share, 0),
    commission_rate = case
      when coalesce(amount, 0) > 0 then round(coalesce(platform_share, 0) / amount * 100, 2)
      else 0
    end
where seller_id is not null and commission_amount is null;

create table if not exists public.marketplace_commission_settings (
  id smallint primary key default 1 check (id = 1),
  commission_rate numeric(5,2) not null default 0 check (commission_rate between 0 and 100),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.marketplace_commission_settings(id, commission_rate)
values (1, 0) on conflict (id) do nothing;
alter table public.marketplace_commission_settings enable row level security;
revoke all on public.marketplace_commission_settings from anon, authenticated;

-- Separate suspension from KYC verification. Existing approved status is preserved.
alter table public.seller_applications
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

create table if not exists public.seller_ledger (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id),
  order_id uuid references public.orders(id),
  withdrawal_id uuid references public.withdrawal_requests(id),
  entry_type text not null check (entry_type in (
    'sale_credit','commission_debit','sale_reversal',
    'withdrawal_reserve','withdrawal_release','withdrawal_paid'
  )),
  amount numeric(12,2) not null check (amount >= 0),
  description text not null,
  created_at timestamptz not null default now(),
  unique (order_id, entry_type),
  unique (withdrawal_id, entry_type)
);
create index if not exists seller_ledger_seller_created_idx
  on public.seller_ledger(seller_id, created_at desc);
alter table public.seller_ledger enable row level security;
revoke all on public.seller_ledger from anon, authenticated;

alter table public.withdrawal_requests
  add column if not exists upi_id text,
  add column if not exists processing_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists idempotency_key uuid;

alter table public.withdrawal_requests drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests add constraint withdrawal_requests_status_check
  check (status in ('requested','processing','paid','rejected')) not valid;
alter table public.withdrawal_requests validate constraint withdrawal_requests_status_check;
create unique index if not exists withdrawal_requests_one_open_per_seller
  on public.withdrawal_requests(seller_id) where status in ('requested','processing');
create unique index if not exists withdrawal_requests_seller_idempotency
  on public.withdrawal_requests(seller_id,idempotency_key) where idempotency_key is not null;

create table if not exists public.withdrawal_status_history (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.withdrawal_requests(id),
  from_status text,
  to_status text not null check (to_status in ('requested','processing','paid','rejected')),
  changed_by uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists withdrawal_status_history_request_idx
  on public.withdrawal_status_history(withdrawal_id, created_at);
alter table public.withdrawal_status_history enable row level security;
revoke all on public.withdrawal_status_history from anon, authenticated;

-- Make the existing seller guard respect suspension. Verified/KYC status remains approved.
create or replace function public.current_user_is_seller()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.seller_applications a on a.user_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'seller'
      and a.status = 'approved'
      and not a.is_suspended
  );
$$;
revoke all on function public.current_user_is_seller() from public, anon;
grant execute on function public.current_user_is_seller() to authenticated;

create or replace function public.seller_balance(p_seller_id uuid)
returns table(pending_balance numeric, available_balance numeric)
language sql stable security definer set search_path = ''
as $$
  select
    coalesce(sum(o.seller_share) filter (where o.available_on > now() and not o.refunded), 0)::numeric(12,2),
    greatest(
      coalesce(sum(o.seller_share) filter (where o.available_on <= now() and not o.refunded), 0)
      - coalesce((
        select sum(w.amount) from public.withdrawal_requests w
        where w.seller_id = p_seller_id and w.status in ('requested','processing','paid')
      ), 0)
      - 500,
      0
    )::numeric(12,2)
  from public.orders o
  where o.seller_id = p_seller_id
    and p_seller_id = (select auth.uid())
    and public.current_user_is_seller()
    and o.seller_share is not null;
$$;
revoke all on function public.seller_balance(uuid) from public, anon;
grant execute on function public.seller_balance(uuid) to authenticated;

create or replace function public.seller_update_upi(p_upi_id text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_upi_id,''))) not between 5 and 100
     or trim(p_upi_id) !~* '^[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]{1,63}$' then
    raise exception 'Enter a valid UPI ID' using errcode = '22023';
  end if;
  update public.seller_applications
  set upi_id = lower(trim(p_upi_id))
  where user_id = auth.uid() and status = 'approved' and not is_suspended;
  if not found then raise exception 'approved seller account not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.seller_update_upi(text) from public, anon;
grant execute on function public.seller_update_upi(text) to authenticated;

create or replace function public.seller_request_withdrawal(p_amount numeric, p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_seller uuid := auth.uid();
  v_upi text;
  v_released numeric(12,2);
  v_reserved numeric(12,2);
  v_id uuid;
  v_existing uuid;
begin
  if v_seller is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or round(p_amount,2) <> p_amount or p_idempotency_key is null then
    raise exception 'Enter a valid amount and request key' using errcode = '22023';
  end if;

  -- Per-seller row lock serializes request creation, preventing concurrent over-withdrawal.
  select a.upi_id into v_upi
  from public.seller_applications a
  where a.user_id = v_seller and a.status = 'approved' and not a.is_suspended
  for update;
  if not found or v_upi is null
     or v_upi !~* '^[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]{1,63}$' then
    raise exception 'Save a valid UPI ID before requesting withdrawal' using errcode = '22023';
  end if;

  select id into v_existing
  from public.withdrawal_requests
  where seller_id = v_seller and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  select coalesce(sum(seller_share) filter (where available_on <= now() and not refunded), 0)
  into v_released
  from public.orders
  where seller_id = v_seller and seller_share is not null;

  select coalesce(sum(amount), 0) into v_reserved
  from public.withdrawal_requests
  where seller_id = v_seller and status in ('requested','processing','paid');

  if p_amount > greatest(v_released - v_reserved - 500, 0) then
    raise exception 'Withdrawal exceeds your withdrawable balance of ₹%',
      to_char(greatest(v_released - v_reserved - 500, 0), 'FM999999990.00')
      using errcode = '22023';
  end if;

  insert into public.withdrawal_requests(seller_id,amount,status,upi_id,idempotency_key)
  values (v_seller,p_amount,'requested',lower(trim(v_upi)),p_idempotency_key)
  returning id into v_id;

  insert into public.seller_ledger(seller_id,withdrawal_id,entry_type,amount,description)
  values (v_seller,v_id,'withdrawal_reserve',p_amount,'Withdrawal amount reserved');

  insert into public.withdrawal_status_history(withdrawal_id,from_status,to_status,changed_by)
  values (v_id,null,'requested',v_seller);
  return v_id;
end;
$$;
revoke all on function public.seller_request_withdrawal(numeric,uuid) from public, anon;
grant execute on function public.seller_request_withdrawal(numeric,uuid) to authenticated;

create or replace function public.admin_transition_withdrawal(
  p_request_id uuid, p_status text, p_reason text default null, p_upi_reference text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_row public.withdrawal_requests%rowtype;
begin
  if v_admin is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('processing','paid','rejected') then
    raise exception 'invalid withdrawal status' using errcode = '22023';
  end if;
  if p_status = 'rejected' and length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'A rejection reason is required' using errcode = '22023';
  end if;
  select * into v_row from public.withdrawal_requests where id = p_request_id for update;
  if not found or v_row.status not in ('requested','processing') then
    raise exception 'withdrawal request not found or already completed' using errcode = 'P0002';
  end if;
  if p_status = 'processing' and v_row.status <> 'requested' then
    raise exception 'Only pending requests can be approved' using errcode = '22023';
  end if;
  if p_status = 'paid' and v_row.status <> 'processing' then
    raise exception 'Move request to processing after manual payout before marking paid' using errcode = '22023';
  end if;

  update public.withdrawal_requests
  set status = p_status,
      processing_at = case when p_status = 'processing' then now() else processing_at end,
      paid_at = case when p_status = 'paid' then now() else paid_at end,
      rejected_at = case when p_status = 'rejected' then now() else rejected_at end,
      rejection_reason = case when p_status = 'rejected' then trim(p_reason) else rejection_reason end,
      upi_reference = case when p_status = 'paid' then nullif(trim(p_upi_reference),'') else upi_reference end
  where id = p_request_id;

  if p_status = 'paid' then
    insert into public.seller_ledger(seller_id,withdrawal_id,entry_type,amount,description)
    values (v_row.seller_id,p_request_id,'withdrawal_paid',v_row.amount,'Withdrawal marked paid');
  elsif p_status = 'rejected' then
    insert into public.seller_ledger(seller_id,withdrawal_id,entry_type,amount,description)
    values (v_row.seller_id,p_request_id,'withdrawal_release',v_row.amount,'Rejected withdrawal reservation released');
  end if;

  insert into public.withdrawal_status_history(withdrawal_id,from_status,to_status,changed_by,reason)
  values (p_request_id,v_row.status,p_status,v_admin,case when p_status = 'rejected' then trim(p_reason) end);
end;
$$;
revoke all on function public.admin_transition_withdrawal(uuid,text,text,text) from public, anon;
grant execute on function public.admin_transition_withdrawal(uuid,text,text,text) to authenticated;

create or replace function public.admin_set_marketplace_commission(p_rate numeric)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 100 or round(p_rate,2) <> p_rate then
    raise exception 'Commission must be between 0 and 100 percent with at most 2 decimals' using errcode = '22023';
  end if;
  update public.marketplace_commission_settings
  set commission_rate = p_rate, updated_by = auth.uid(), updated_at = now()
  where id = 1;
end;
$$;
revoke all on function public.admin_set_marketplace_commission(numeric) from public, anon;
grant execute on function public.admin_set_marketplace_commission(numeric) to authenticated;

create or replace function public.sync_seller_order_accounting()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_seller uuid;
  v_product_type text;
  v_rate numeric(5,2);
begin
  if new.product_id is null then
    new.seller_id := null; new.seller_share := null; new.platform_share := null;
    new.available_on := null; new.commission_rate := null; new.commission_amount := null;
    return new;
  end if;
  select seller_id, product_type into v_seller, v_product_type
  from public.products where id = new.product_id;

  if lower(coalesce(new.payment_status::text,'')) <> 'verified'
     or v_seller is null or v_product_type <> 'pdf' then
    new.seller_id := null; new.seller_share := null; new.platform_share := null;
    new.available_on := null; new.commission_rate := null; new.commission_amount := null;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.seller_id = v_seller and old.commission_rate is not null then
    v_rate := old.commission_rate;
  else
    select commission_rate into v_rate from public.marketplace_commission_settings where id = 1;
  end if;
  v_rate := coalesce(v_rate,0);
  new.seller_id := v_seller;
  new.commission_rate := v_rate;
  new.commission_amount := round(new.amount * v_rate / 100,2);
  new.platform_share := new.commission_amount;
  new.seller_share := round(new.amount - new.commission_amount,2);
  new.available_on := coalesce(new.verified_at,new.created_at,now()) + interval '7 days';
  return new;
end;
$$;

-- Immutable ledger: record first sale credit/fee and a compensating event for refunds.
create or replace function public.append_seller_sale_ledger()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.seller_id is not null and new.seller_share is not null
     and (tg_op = 'INSERT' or old.seller_id is distinct from new.seller_id
       or old.seller_share is distinct from new.seller_share
       or old.commission_amount is distinct from new.commission_amount) then
    insert into public.seller_ledger(seller_id,order_id,entry_type,amount,description)
    values (new.seller_id,new.id,'sale_credit',new.seller_share,'Seller net sale credit')
    on conflict (order_id,entry_type) do nothing;
    if new.commission_amount > 0 then
      insert into public.seller_ledger(seller_id,order_id,entry_type,amount,description)
      values (new.seller_id,new.id,'commission_debit',new.commission_amount,'Marketplace commission at order time')
      on conflict (order_id,entry_type) do nothing;
    end if;
  elsif tg_op = 'UPDATE' and old.refunded = false and new.refunded = true
        and old.seller_id is not null and old.seller_share is not null then
    insert into public.seller_ledger(seller_id,order_id,entry_type,amount,description)
    values (old.seller_id,old.id,'sale_reversal',old.seller_share,'Refund reversal of seller sale credit')
    on conflict (order_id,entry_type) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_seller_order_accounting on public.orders;
create trigger sync_seller_order_accounting
before insert or update of product_id,amount,payment_status,verified_at
on public.orders for each row execute function public.sync_seller_order_accounting();
drop trigger if exists append_seller_sale_ledger on public.orders;
create trigger append_seller_sale_ledger
after insert or update of product_id,amount,payment_status,verified_at,refunded
on public.orders for each row execute function public.append_seller_sale_ledger();

-- Backfill audit events from existing accounting without changing historical order shares.
insert into public.seller_ledger(seller_id,order_id,entry_type,amount,description,created_at)
select seller_id,id,'sale_credit',seller_share,'Historical seller net sale credit',coalesce(verified_at,created_at)
from public.orders where seller_id is not null and seller_share is not null
on conflict (order_id,entry_type) do nothing;
insert into public.seller_ledger(seller_id,order_id,entry_type,amount,description,created_at)
select seller_id,id,'commission_debit',commission_amount,'Historical order commission',coalesce(verified_at,created_at)
from public.orders where seller_id is not null and commission_amount > 0
on conflict (order_id,entry_type) do nothing;
insert into public.seller_ledger(seller_id,order_id,entry_type,amount,description,created_at)
select seller_id,id,'sale_reversal',seller_share,'Historical refunded sale reversal',coalesce(verified_at,created_at)
from public.orders where seller_id is not null and seller_share is not null and refunded
on conflict (order_id,entry_type) do nothing;

create or replace function public.seller_wallet_summary()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'lifetime_earnings',coalesce(sum(seller_share) filter (where not refunded),0),
    'commission_deducted',coalesce(sum(commission_amount) filter (where not refunded),0),
    'pending_balance',coalesce(sum(seller_share) filter (where available_on > now() and not refunded),0),
    'released_earnings',coalesce(sum(seller_share) filter (where available_on <= now() and not refunded),0),
    'pending_withdrawals',(select coalesce(sum(amount),0) from public.withdrawal_requests
      where seller_id=v_user and status in ('requested','processing')),
    'withdrawable_balance',greatest(coalesce(sum(seller_share) filter (where available_on <= now() and not refunded),0)
      -(select coalesce(sum(amount),0) from public.withdrawal_requests
        where seller_id=v_user and status in ('requested','processing','paid'))-500,0)
  ) into v_result
  from public.orders where seller_id=v_user and seller_share is not null;
  return v_result;
end;
$$;
revoke all on function public.seller_wallet_summary() from public, anon;
grant execute on function public.seller_wallet_summary() to authenticated;

create or replace function public.seller_withdrawal_history()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',w.id,'amount',w.amount,'status',w.status,'upi_id',w.upi_id,
    'requested_at',w.requested_at,'processing_at',w.processing_at,'paid_at',w.paid_at,
    'rejected_at',w.rejected_at,'rejection_reason',w.rejection_reason,'upi_reference',w.upi_reference
  ) order by w.requested_at desc),'[]'::jsonb)
  from public.withdrawal_requests w
  where w.seller_id = (select auth.uid()) and public.current_user_is_seller();
$$;
revoke all on function public.seller_withdrawal_history() from public, anon;
grant execute on function public.seller_withdrawal_history() to authenticated;

create or replace function public.seller_wallet_upi()
returns text language sql stable security definer set search_path = ''
as $$
  select upi_id from public.seller_applications
  where user_id = (select auth.uid()) and status = 'approved' and not is_suspended
    and public.current_user_is_seller();
$$;
revoke all on function public.seller_wallet_upi() from public, anon;
grant execute on function public.seller_wallet_upi() to authenticated;

-- Seller admin data stays behind a narrowly scoped RPC, never broad KYC/document access.
create or replace function public.admin_seller_wallets()
returns table(
  seller_id uuid, full_name text, email text, verification_status text,
  is_suspended boolean, total_sales bigint, lifetime_earnings numeric,
  commission_deducted numeric, pending_balance numeric, released_earnings numeric,
  pending_withdrawals numeric, withdrawable_balance numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  return query
  select a.user_id,p.full_name,p.email,a.status,a.is_suspended,
    count(o.id) filter (where not o.refunded)::bigint,
    coalesce(sum(o.seller_share) filter (where not o.refunded),0)::numeric,
    coalesce(sum(o.commission_amount) filter (where not o.refunded),0)::numeric,
    coalesce(sum(o.seller_share) filter (where o.available_on > now() and not o.refunded),0)::numeric,
    coalesce(sum(o.seller_share) filter (where o.available_on <= now() and not o.refunded),0)::numeric,
    coalesce((select sum(w.amount) from public.withdrawal_requests w
      where w.seller_id=a.user_id and w.status in ('requested','processing')),0)::numeric,
    greatest(coalesce(sum(o.seller_share) filter (where o.available_on <= now() and not o.refunded),0)
      -(select coalesce(sum(w.amount),0) from public.withdrawal_requests w
        where w.seller_id=a.user_id and w.status in ('requested','processing','paid'))-500,0)::numeric
  from public.seller_applications a
  join public.profiles p on p.id=a.user_id
  left join public.orders o on o.seller_id=a.user_id and o.seller_share is not null
  where a.status='approved'
  group by a.user_id,p.full_name,p.email,a.status,a.is_suspended;
end;
$$;
revoke all on function public.admin_seller_wallets() from public, anon;
grant execute on function public.admin_seller_wallets() to authenticated;

create or replace function public.admin_set_seller_suspension(p_seller_id uuid,p_suspended boolean,p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode='42501';
  end if;
  if p_seller_id is null or p_suspended is null then
    raise exception 'seller and suspension state are required' using errcode='22023';
  end if;
  if p_suspended and length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'A suspension reason is required' using errcode='22023';
  end if;
  update public.seller_applications
  set is_suspended=p_suspended,
      suspended_at=case when p_suspended then now() else null end,
      suspension_reason=case when p_suspended then trim(p_reason) else null end
  where user_id=p_seller_id and status='approved';
  if not found then raise exception 'approved seller not found' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.admin_set_seller_suspension(uuid,boolean,text) from public, anon;
grant execute on function public.admin_set_seller_suspension(uuid,boolean,text) to authenticated;

create or replace function public.admin_withdrawal_queue()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',w.id,'seller_id',w.seller_id,'seller_name',p.full_name,'email',p.email,
      'amount',w.amount,'upi_id',w.upi_id,'status',w.status,'requested_at',w.requested_at,
      'processing_at',w.processing_at,'paid_at',w.paid_at,'rejected_at',w.rejected_at,
      'rejection_reason',w.rejection_reason,'upi_reference',w.upi_reference
    ) order by w.requested_at asc),'[]'::jsonb)
    from public.withdrawal_requests w join public.profiles p on p.id=w.seller_id
  );
end;
$$;
revoke all on function public.admin_withdrawal_queue() from public, anon;
grant execute on function public.admin_withdrawal_queue() to authenticated;

create or replace function public.admin_get_marketplace_commission()
returns table(commission_rate numeric,updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  return query select s.commission_rate,s.updated_at
    from public.marketplace_commission_settings s where s.id=1;
end;
$$;
revoke all on function public.admin_get_marketplace_commission() from public, anon;
grant execute on function public.admin_get_marketplace_commission() to authenticated;

-- Prevent direct or accidental editing of ledger rows; trusted triggers/RPCs can only INSERT.
create or replace function public.prevent_seller_ledger_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Seller ledger is append-only' using errcode = '42501';
end;
$$;
drop trigger if exists seller_ledger_no_mutation on public.seller_ledger;
create trigger seller_ledger_no_mutation before update or delete on public.seller_ledger
for each row execute function public.prevent_seller_ledger_mutation();

commit;