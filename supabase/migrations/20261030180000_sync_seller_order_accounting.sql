-- Attribute verified marketplace orders to the seller who owns the purchased product.
-- This fixes orders created before the product had a seller_id and ensures future
-- payment verification (client verification and Razorpay webhook) updates accounting.

begin;

create or replace function public.sync_seller_order_accounting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid;
  v_product_type text;
begin
  if new.product_id is null then
    new.seller_id := null;
    new.seller_share := null;
    new.platform_share := null;
    new.available_on := null;
    return new;
  end if;

  select p.seller_id, p.product_type
    into v_seller_id, v_product_type
  from public.products p
  where p.id = new.product_id;

  -- Only verified purchases of seller-owned digital products earn seller share.
  -- Never trust seller_id or share values supplied by the checkout client.
  if lower(coalesce(new.payment_status::text, '')) <> 'verified'
     or v_seller_id is null
     or v_product_type <> 'pdf' then
    new.seller_id := null;
    new.seller_share := null;
    new.platform_share := null;
    new.available_on := null;
    return new;
  end if;

  new.seller_id := v_seller_id;
  new.seller_share := round(new.amount * 0.90, 2);
  new.platform_share := round(new.amount - new.seller_share, 2);
  new.available_on := coalesce(new.verified_at, new.created_at, now()) + interval '7 days';

  return new;
end;
$$;

drop trigger if exists sync_seller_order_accounting on public.orders;
create trigger sync_seller_order_accounting
before insert or update of product_id, amount, payment_status, verified_at
on public.orders
for each row
execute function public.sync_seller_order_accounting();

-- Repair historical verified purchases made against seller-owned products.
-- This is safe to re-run and leaves buyer/order/payment fields unchanged.
update public.orders o
set seller_id = p.seller_id,
    seller_share = round(o.amount * 0.90, 2),
    platform_share = round(o.amount - round(o.amount * 0.90, 2), 2),
    available_on = coalesce(o.verified_at, o.created_at, now()) + interval '7 days'
from public.products p
where p.id = o.product_id
  and p.seller_id is not null
  and p.product_type = 'pdf'
  and lower(o.payment_status::text) = 'verified'
  and (
    o.seller_id is distinct from p.seller_id
    or o.seller_share is distinct from round(o.amount * 0.90, 2)
    or o.platform_share is distinct from round(o.amount - round(o.amount * 0.90, 2), 2)
    or o.available_on is null
  );

comment on function public.sync_seller_order_accounting() is
  'Derives seller attribution and 90/10 shares from the purchased product when an order is verified; never trusts client-supplied accounting fields.';

commit;
