-- Transactionally reserve refund amounts so concurrent admin requests cannot over-refund.
begin;

create or replace function public.reserve_razorpay_refund(
  p_order_id uuid,
  p_amount_paise bigint,
  p_reason text,
  p_requested_by uuid
)
returns table (
  refund_id uuid,
  payment_id text,
  order_amount_paise bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_reserved bigint;
  v_total bigint;
  v_refund_id uuid;
begin
  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'Refund amount must be positive';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_gateway <> 'razorpay' then raise exception 'Order was not paid through Razorpay'; end if;
  if v_order.payment_status <> 'verified' or v_order.razorpay_payment_id is null then
    raise exception 'Only verified Razorpay payments can be refunded';
  end if;
  if v_order.razorpay_status not in ('paid', 'partially_refunded') then
    raise exception 'Order is not refundable in its current state';
  end if;

  v_total := round(v_order.amount::numeric * 100)::bigint;
  select coalesce(sum(r.amount_paise), 0)::bigint into v_reserved
  from public.razorpay_refunds r
  where r.order_id = p_order_id and r.status in ('requested', 'processed');

  if p_amount_paise > v_total - v_reserved then
    raise exception 'Refund exceeds the remaining refundable balance';
  end if;

  insert into public.razorpay_refunds (
    order_id, razorpay_payment_id, amount_paise, currency, status, reason, requested_by
  ) values (
    p_order_id, v_order.razorpay_payment_id, p_amount_paise, 'INR', 'requested',
    nullif(left(trim(coalesce(p_reason, '')), 500), ''), p_requested_by
  ) returning id into v_refund_id;

  return query select v_refund_id, v_order.razorpay_payment_id, v_total;
end;
$$;

revoke all on function public.reserve_razorpay_refund(uuid, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_razorpay_refund(uuid, bigint, text, uuid) to service_role;

commit;
