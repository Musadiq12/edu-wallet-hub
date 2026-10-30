begin;
create or replace function public.seller_request_withdrawal(p_amount numeric,p_idempotency_key uuid)
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
  -- Lock the application row; this is the serialization point for one-open-request and balance checks.
  select a.upi_id into v_upi
  from public.seller_applications a
  where a.user_id = v_seller and a.status = 'approved' and not a.is_suspended
  for update;
  if not found or v_upi is null
     or v_upi !~* '^[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]{1,63}$' then
    raise exception 'Save a valid UPI ID before requesting withdrawal' using errcode = '22023';
  end if;
  select id into v_existing from public.withdrawal_requests
  where seller_id = v_seller and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  if exists(select 1 from public.withdrawal_requests
            where seller_id=v_seller and status in ('requested','processing')) then
    raise exception 'You already have a withdrawal request in progress' using errcode = '23505';
  end if;
  select coalesce(sum(seller_share) filter(where available_on <= now() and not refunded),0)
  into v_released from public.orders where seller_id=v_seller and seller_share is not null;
  select coalesce(sum(amount),0) into v_reserved
  from public.withdrawal_requests
  where seller_id=v_seller and status in ('requested','processing','paid');
  if p_amount > greatest(v_released-v_reserved-500,0) then
    raise exception 'Withdrawal exceeds your withdrawable balance of ₹%',
      to_char(greatest(v_released-v_reserved-500,0),'FM999999990.00') using errcode='22023';
  end if;
  insert into public.withdrawal_requests(seller_id,amount,status,upi_id,idempotency_key)
  values(v_seller,p_amount,'requested',lower(trim(v_upi)),p_idempotency_key) returning id into v_id;
  insert into public.seller_ledger(seller_id,withdrawal_id,entry_type,amount,description)
  values(v_seller,v_id,'withdrawal_reserve',p_amount,'Withdrawal amount reserved');
  insert into public.withdrawal_status_history(withdrawal_id,from_status,to_status,changed_by)
  values(v_id,null,'requested',v_seller);
  return v_id;
end;
$$;
revoke all on function public.seller_request_withdrawal(numeric,uuid) from public,anon;
grant execute on function public.seller_request_withdrawal(numeric,uuid) to authenticated;

-- Audit order corrections with signed-direction entries, never by mutating a previous entry.
alter table public.seller_ledger drop constraint if exists seller_ledger_entry_type_check;
alter table public.seller_ledger add constraint seller_ledger_entry_type_check check(entry_type in (
 'sale_credit','commission_debit','sale_reversal','sale_adjustment_credit','sale_adjustment_debit',
 'commission_adjustment_credit','commission_adjustment_debit','withdrawal_reserve','withdrawal_release','withdrawal_paid'
));
alter table public.seller_ledger drop constraint if exists seller_ledger_order_id_entry_type_key;
drop index if exists public.seller_ledger_order_id_entry_type_key;
create unique index if not exists seller_ledger_once_per_order_event
on public.seller_ledger(order_id,entry_type)
where entry_type in ('sale_credit','commission_debit','sale_reversal');

commit;