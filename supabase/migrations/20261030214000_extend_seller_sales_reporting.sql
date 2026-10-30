begin;

-- Keep the existing seller_sales columns in exactly their original order.
-- New commission fields are appended so CREATE OR REPLACE VIEW remains compatible.
create or replace view public.seller_sales with (security_barrier=true) as
select
  o.id,
  o.created_at,
  o.product_title,
  o.seller_share,
  o.available_on,
  o.refunded,
  coalesce(nullif(split_part(btrim(o.full_name),' ',1),''),'Customer') as buyer_first_name,
  o.commission_amount,
  o.commission_rate
from public.orders o
where o.seller_id=(select auth.uid()) and public.current_user_is_seller();

revoke all on public.seller_sales from public,anon;
grant select on public.seller_sales to authenticated;

commit;