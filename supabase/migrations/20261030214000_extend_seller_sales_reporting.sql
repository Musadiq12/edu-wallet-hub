begin;

-- Preserve the seller-safe sales projection and add fee snapshots without exposing buyer data.
create or replace view public.seller_sales with (security_barrier=true) as
select
  o.id,
  o.created_at,
  o.product_title,
  o.seller_share,
  o.commission_amount,
  o.commission_rate,
  o.available_on,
  o.refunded,
  coalesce(nullif(split_part(btrim(o.full_name),' ',1),''),'Customer') as buyer_first_name
from public.orders o
where o.seller_id=(select auth.uid()) and public.current_user_is_seller();

revoke all on public.seller_sales from public,anon;
grant select on public.seller_sales to authenticated;

commit;