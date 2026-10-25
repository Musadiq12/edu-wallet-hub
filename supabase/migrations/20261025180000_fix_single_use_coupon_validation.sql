-- Align the coupon preview with the database's authoritative order-insert checks.
-- A single-use coupon must be rejected before the UI shows a discount, not only when
-- the order trigger rejects the subsequent checkout request.
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text, p_product_id uuid, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  c public.coupons%ROWTYPE;
  v_eligible boolean;
  v_excluded boolean;
  v_discount numeric(12,2);
  v_attempts integer;
  v_window_start timestamptz;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) < 3 OR length(trim(p_code)) > 64
     OR p_subtotal IS NULL OR p_subtotal < 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'COUPON_NOT_FOUND');
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'COUPON_NOT_FOUND');
  END IF;

  INSERT INTO public.coupon_validation_limits(user_id, window_started_at, attempts)
  VALUES (auth.uid(), now(), 1)
  ON CONFLICT (user_id) DO UPDATE SET
    window_started_at = CASE
      WHEN public.coupon_validation_limits.window_started_at <= now() - interval '15 minutes' THEN now()
      ELSE public.coupon_validation_limits.window_started_at
    END,
    attempts = CASE
      WHEN public.coupon_validation_limits.window_started_at <= now() - interval '15 minutes' THEN 1
      ELSE public.coupon_validation_limits.attempts + 1
    END
  RETURNING attempts, window_started_at INTO v_attempts, v_window_start;

  IF v_attempts > 10 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'COUPON_NOT_FOUND');
  END IF;

  SELECT * INTO c FROM public.coupons WHERE upper(trim(code)) = upper(trim(p_code));
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'error', 'COUPON_NOT_FOUND'); END IF;
  IF c.status NOT IN ('ACTIVE','SCHEDULED')
     OR (c.status = 'SCHEDULED' AND (c.starts_at IS NULL OR c.starts_at > now()))
     OR (c.starts_at IS NOT NULL AND c.starts_at > now())
     OR (c.ends_at IS NOT NULL AND c.ends_at <= now()) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'COUPON_EXPIRED');
  END IF;
  IF c.total_usage_limit IS NOT NULL AND c.usage_count >= c.total_usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'USAGE_LIMIT_REACHED');
  END IF;
  IF p_subtotal < c.min_subtotal THEN
    RETURN jsonb_build_object('valid', false, 'error', 'MIN_SUBTOTAL_NOT_MET');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.coupon_targets t
    WHERE t.coupon_id = c.id AND t.mode = 'INCLUDE'
      AND (t.target_type = 'ALL_PRODUCTS'
        OR (t.target_type = 'PRODUCT' AND t.target_id = p_product_id)
        OR (t.target_type = 'CATEGORY' AND t.target_id = (
          SELECT category_id FROM public.products WHERE id = p_product_id
        )))
  ) INTO v_eligible;
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_targets t
    WHERE t.coupon_id = c.id AND t.mode = 'EXCLUDE'
      AND (t.target_type = 'ALL_PRODUCTS'
        OR (t.target_type = 'PRODUCT' AND t.target_id = p_product_id)
        OR (t.target_type = 'CATEGORY' AND t.target_id = (
          SELECT category_id FROM public.products WHERE id = p_product_id
        )))
  ) INTO v_excluded;
  IF NOT v_eligible OR v_excluded THEN
    RETURN jsonb_build_object('valid', false, 'error', 'NOT_ELIGIBLE_FOR_CART');
  END IF;

  -- This was the missing check: the order trigger already enforced it, but the
  -- preview RPC did not, so returning customers saw a discount that could not check out.
  IF c.per_customer_limit IS NOT NULL AND (
    SELECT count(*)
    FROM public.coupon_redemptions r
    WHERE r.coupon_id = c.id AND r.customer_id = auth.uid()
  ) >= c.per_customer_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'USAGE_LIMIT_REACHED');
  END IF;

  -- Match the existing order trigger so first-order-only coupons fail before preview too.
  IF c.first_order_only AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = auth.uid() AND o.order_status::text <> 'cancelled'
  ) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'NOT_ELIGIBLE_FOR_CART');
  END IF;

  v_discount := CASE
    WHEN c.discount_type = 'PERCENTAGE' THEN
      round(least(p_subtotal, p_subtotal * c.discount_value / 100,
        COALESCE(c.max_discount_amount, p_subtotal)), 2)
    WHEN c.discount_type = 'FIXED_AMOUNT' THEN round(least(p_subtotal, c.discount_value), 2)
    ELSE 0
  END;
  RETURN jsonb_build_object('valid', true, 'couponId', c.id, 'code', c.code, 'label', c.public_label,
    'discountType', c.discount_type, 'discountValue', c.discount_value, 'discountAmount', v_discount,
    'total', greatest(0, round(p_subtotal - v_discount, 2)), 'stackable', c.stackable);
END;
$function$;

-- Trigger functions must run from their table triggers, not be callable as public RPC endpoints.
REVOKE ALL ON FUNCTION public.consume_coupon_for_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_coupon_redemption() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_coupon(text, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO authenticated;
