-- Seller notification center: complete the existing seller_notifications system.
begin;

alter table public.seller_notifications
  drop constraint if exists seller_notifications_event_type_check;
alter table public.seller_notifications
  add constraint seller_notifications_event_type_check check (event_type in (
    'approved','rejected','unpublished','republished',
    'account_approved','account_rejected','account_suspended','account_reinstated',
    'sale_verified','payout_requested','payout_processing','payout_paid','payout_rejected',
    'low_stock','system_announcement'
  ));

-- A notification may be inserted only by trusted server-side workflows.
revoke all on public.seller_notifications from anon, authenticated;
grant select on public.seller_notifications to authenticated;
grant update(read_at) on public.seller_notifications to authenticated;
grant insert, update, delete on public.seller_notifications to service_role;

drop policy if exists seller_notifications_read_own on public.seller_notifications;
create policy seller_notifications_read_own on public.seller_notifications
for select to authenticated
using (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.seller_applications a on a.user_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'seller' and a.status = 'approved' and not a.is_suspended
  )
);

drop policy if exists seller_notifications_update_own on public.seller_notifications;
create policy seller_notifications_update_own on public.seller_notifications
for update to authenticated
using (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.seller_applications a on a.user_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'seller' and a.status = 'approved' and not a.is_suspended
  )
)
with check (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.seller_applications a on a.user_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'seller' and a.status = 'approved' and not a.is_suspended
  )
);

create index if not exists seller_notifications_seller_created_idx
  on public.seller_notifications(seller_id, created_at desc);
create index if not exists seller_notifications_unread_idx
  on public.seller_notifications(seller_id, created_at desc)
  where read_at is null;

-- Subscribe only to notification rows. Client RLS restricts delivery to the owning seller.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seller_notifications'
  ) then
    alter publication supabase_realtime add table public.seller_notifications;
  end if;
end $$;

-- Seller account approval/rejection is emitted in the same transaction as moderation.
create or replace function public.server_review_seller_application(
  p_application_id uuid,
  p_status text,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_full_name text;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected' using errcode = '22023';
  end if;
  if p_status = 'rejected' and length(btrim(coalesce(p_rejection_reason, ''))) < 3 then
    raise exception 'a rejection reason is required' using errcode = '22023';
  end if;

  update public.seller_applications
  set status = p_status,
      rejection_reason = case when p_status = 'rejected' then btrim(p_rejection_reason) else null end,
      reviewed_at = now()
  where id = p_application_id and status = 'pending'
  returning user_id, full_name into v_user_id, v_full_name;
  if not found then
    raise exception 'seller application not found or already reviewed' using errcode = 'P0002';
  end if;

  if p_status = 'approved' then
    update public.profiles set role = 'seller' where id = v_user_id;
    if not found then raise exception 'applicant profile not found' using errcode = 'P0002'; end if;
    insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
    values(v_user_id,'account_approved','Your seller account is approved',
      'Your EduWallet seller account has been verified. You can now publish products and manage sales.','/seller/dashboard');
  else
    insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
    values(v_user_id,'account_rejected','Seller application update',
      'Your seller application was not approved. Reason: ' || left(btrim(p_rejection_reason),1000),'/become-seller');
  end if;
end;
$$;
revoke all on function public.server_review_seller_application(uuid,text,text) from public, anon, authenticated;
grant execute on function public.server_review_seller_application(uuid,text,text) to service_role;

-- Notify on verified seller sales and refund reversals without trusting checkout input.
create or replace function public.notify_seller_order_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.seller_id is not null and new.seller_share is not null then
      insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
      values(
        new.seller_id,'sale_verified','You made a sale',
        'Your product "' || left(new.product_title,160) || '" has a verified sale. Your net share is ₹' ||
        to_char(new.seller_share,'FM999999990.00') || '.',
        '/seller/sales'
      );
    end if;
    return new;
  end if;

  if old.seller_id is distinct from new.seller_id
     and new.seller_id is not null and new.seller_share is not null then
    insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
    values(new.seller_id,'sale_verified','You made a sale',
      'Your product "' || left(new.product_title,160) || '" has a verified sale. Your net share is ₹' ||
      to_char(new.seller_share,'FM999999990.00') || '.','/seller/sales');
  elsif old.seller_id is null and new.seller_id is not null and new.seller_share is not null then
    insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
    values(new.seller_id,'sale_verified','You made a sale',
      'Your product "' || left(new.product_title,160) || '" has a verified sale. Your net share is ₹' ||
      to_char(new.seller_share,'FM999999990.00') || '.','/seller/sales');
  end if;

  if old.refunded is false and new.refunded is true and old.seller_id is not null then
    insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
    values(old.seller_id,'system_announcement','A sale was refunded',
      'The order for "' || left(old.product_title,160) || '" was refunded. Its earning has been reversed in your wallet.',
      '/seller/sales');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_seller_order_events on public.orders;
create trigger notify_seller_order_events
after insert or update of seller_id, seller_share, refunded
on public.orders for each row execute function public.notify_seller_order_events();
revoke all on function public.notify_seller_order_events() from public, anon, authenticated;
grant execute on function public.notify_seller_order_events() to service_role;

-- Payout lifecycle notifications are written atomically alongside the admin transition.
create or replace function public.admin_transition_withdrawal(
  p_request_id uuid, p_status text, p_reason text default null, p_upi_reference text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_row public.withdrawal_requests%rowtype;
  v_title text;
  v_message text;
  v_event text;
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

  v_event := case p_status when 'processing' then 'payout_processing' when 'paid' then 'payout_paid' else 'payout_rejected' end;
  v_title := case p_status when 'processing' then 'Payout is being processed' when 'paid' then 'Payout completed' else 'Payout request rejected' end;
  v_message := case p_status
    when 'processing' then 'Your withdrawal request for ₹' || to_char(v_row.amount,'FM999999990.00') || ' is being processed. EduWallet will complete the UPI transfer within 24 hours.'
    when 'paid' then 'Your payout of ₹' || to_char(v_row.amount,'FM999999990.00') || ' has been marked paid.' ||
      case when nullif(trim(p_upi_reference),'') is null then '' else ' UPI reference: ' || left(trim(p_upi_reference),100) end
    else 'Your withdrawal request for ₹' || to_char(v_row.amount,'FM999999990.00') || ' was rejected. Reason: ' || left(trim(p_reason),500) || '. The reserved amount has been released.'
  end;
  insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
  values(v_row.seller_id,v_event,v_title,v_message,'/seller/wallet');
end;
$$;
revoke all on function public.admin_transition_withdrawal(uuid,text,text,text) from public, anon;
grant execute on function public.admin_transition_withdrawal(uuid,text,text,text) to authenticated;

-- A new withdrawal request is a seller-visible event too.
create or replace function public.notify_seller_withdrawal_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
  values(new.seller_id,'payout_requested','Withdrawal request submitted',
    'Your withdrawal request for ₹' || to_char(new.amount,'FM999999990.00') ||
    ' has been received. EduWallet will process the UPI payout within 24 hours.','/seller/wallet');
  return new;
end;
$$;
drop trigger if exists notify_seller_withdrawal_request on public.withdrawal_requests;
create trigger notify_seller_withdrawal_request
after insert on public.withdrawal_requests
for each row execute function public.notify_seller_withdrawal_request();
revoke all on function public.notify_seller_withdrawal_request() from public, anon, authenticated;
grant execute on function public.notify_seller_withdrawal_request() to service_role;

-- Suspension and reinstatement change seller access and deserve explicit notice.
create or replace function public.notify_seller_account_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.is_suspended is distinct from new.is_suspended then
    if new.is_suspended then
      insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
      values(new.user_id,'account_suspended','Seller account temporarily suspended',
        'Your seller workspace has been suspended. Reason: ' || left(coalesce(new.suspension_reason,'Not provided'),500) ||
        '. Contact seller support if you believe this is incorrect.','/');
    else
      insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
      values(new.user_id,'account_reinstated','Seller account reinstated',
        'Your seller account has been reinstated. You can access your seller workspace again.','/seller/dashboard');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notify_seller_account_status on public.seller_applications;
create trigger notify_seller_account_status
after update of is_suspended on public.seller_applications
for each row execute function public.notify_seller_account_status();
revoke all on function public.notify_seller_account_status() from public, anon, authenticated;
grant execute on function public.notify_seller_account_status() to service_role;

-- Low stock is useful for physical seller products only. Send once on threshold crossing.
create or replace function public.notify_seller_low_stock()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_threshold integer;
begin
  if new.seller_id is null or new.product_type <> 'physical' then return new; end if;
  v_threshold := coalesce(new.low_stock_threshold, 3);
  if new.stock_quantity <= v_threshold
     and (tg_op = 'INSERT' or old.stock_quantity > v_threshold) then
    insert into public.seller_notifications(seller_id,product_id,event_type,title,message,target_url)
    values(new.seller_id,new.id,'low_stock','A product is running low',
      '"' || left(new.title,160) || '" has ' || new.stock_quantity ||
      ' item(s) remaining. Update the stock before it sells out.','/seller/products');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_seller_low_stock on public.products;
create trigger notify_seller_low_stock
after insert or update of stock_quantity on public.products
for each row execute function public.notify_seller_low_stock();
revoke all on function public.notify_seller_low_stock() from public, anon, authenticated;
grant execute on function public.notify_seller_low_stock() to service_role;

commit;
