-- Temporarily suspend EduWallet marketplace commission.
-- Sellers receive 100% of verified seller-owned PDF order amounts.
-- Keep seller_share/platform_share columns and the existing accounting trigger so
-- a future commission policy can be restored with a later migration.

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

  -- Temporary 0% platform commission: pass the full order amount to the seller.
  new.seller_id := v_seller_id;
  new.seller_share := round(new.amount, 2);
  new.platform_share := 0;
  new.available_on := coalesce(new.verified_at, new.created_at, now()) + interval '7 days';

  return new;
end;
$$;

-- Recalculate existing verified seller orders using the temporary 100% seller share.
-- Buyer payment amounts, payment status, order IDs, and withdrawal records are untouched.
update public.orders o
set seller_id = p.seller_id,
    seller_share = round(o.amount, 2),
    platform_share = 0,
    available_on = coalesce(o.verified_at, o.created_at, now()) + interval '7 days'
from public.products p
where p.id = o.product_id
  and p.seller_id is not null
  and p.product_type = 'pdf'
  and lower(o.payment_status::text) = 'verified'
  and (
    o.seller_id is distinct from p.seller_id
    or o.seller_share is distinct from round(o.amount, 2)
    or o.platform_share is distinct from 0
    or o.available_on is null
  );

comment on function public.sync_seller_order_accounting() is
  'Temporarily applies 0% marketplace commission: verified seller-owned PDF orders receive 100% seller share and 0 platform share. The accounting columns remain for future commission reactivation.';

comment on column public.orders.seller_share is
  'Seller payout amount. Temporarily 100% of verified seller order amount while marketplace commission is disabled.';
comment on column public.orders.platform_share is
  'Platform commission amount. Temporarily 0 while marketplace commission is disabled.';
  
commit;
