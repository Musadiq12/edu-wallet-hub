-- Do not rely on RLS alone: remove public table privileges so coupon catalogs cannot be queried anonymously.
REVOKE ALL ON TABLE public.coupons, public.coupon_targets, public.coupon_redemptions, public.order_discount_allocations FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupons, public.coupon_targets TO authenticated;
GRANT SELECT ON TABLE public.coupon_redemptions, public.order_discount_allocations TO authenticated;
