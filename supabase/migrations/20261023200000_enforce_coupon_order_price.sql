-- Always derive the undiscounted price from the catalog, not the browser's submitted amount.
CREATE OR REPLACE FUNCTION public.consume_coupon_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.coupons%ROWTYPE;
  v_quote jsonb;
  v_discount numeric(12,2);
  v_subtotal numeric(12,2);
  v_prior_orders integer;
BEGIN
  SELECT round(COALESCE(NULLIF(p.discounted_price, 0), p.price), 2)
    INTO v_subtotal
  FROM public.products p
  WHERE p.id = NEW.product_id AND p.is_active = true AND COALESCE(p.is_archived, false) = false AND p.is_free = false;
  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Product is not purchasable';
  END IF;

  IF NEW.coupon_code IS NULL OR trim(NEW.coupon_code) = '' THEN
    NEW.coupon_discount := 0;
    NEW.amount := v_subtotal;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Coupon requires an authenticated customer'; END IF;

  SELECT * INTO c FROM public.coupons WHERE code = upper(trim(NEW.coupon_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COUPON_NOT_FOUND'; END IF;

  v_quote := public.validate_coupon(c.code, NEW.product_id, v_subtotal);
  IF NOT COALESCE((v_quote->>'valid')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_quote->>'error', 'NOT_ELIGIBLE_FOR_CART');
  END IF;
  IF c.per_customer_limit IS NOT NULL AND (
    SELECT count(*) FROM public.coupon_redemptions r WHERE r.coupon_id = c.id AND r.customer_id = NEW.user_id
  ) >= c.per_customer_limit THEN RAISE EXCEPTION 'USAGE_LIMIT_REACHED'; END IF;
  IF c.first_order_only THEN
    SELECT count(*) INTO v_prior_orders FROM public.orders o
      WHERE o.user_id = NEW.user_id AND o.order_status::text <> 'cancelled';
    IF v_prior_orders > 0 THEN RAISE EXCEPTION 'NOT_ELIGIBLE_FOR_CART'; END IF;
  END IF;

  v_discount := round(COALESCE((v_quote->>'discountAmount')::numeric, 0), 2);
  NEW.coupon_code := c.code;
  NEW.coupon_discount := v_discount;
  NEW.amount := greatest(0, round(v_subtotal - v_discount, 2));
  RETURN NEW;
END;
$$;
