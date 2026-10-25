BEGIN;

-- Validation and order creation must agree on a customer's per-coupon limit.
-- A reservation tied to an unfinished order remains valid only for resuming that
-- same product checkout; it must not become a second order.
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
  v_customer_uses integer;
  v_pending_order public.orders%ROWTYPE;
  v_has_pending_other boolean;
  v_prior_orders integer;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) < 3 OR length(trim(p_code)) > 64
     OR p_subtotal IS NULL OR p_subtotal < 0 OR p_product_id IS NULL THEN
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

  SELECT * INTO c
  FROM public.coupons
  WHERE upper(trim(code)) = upper(trim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'COUPON_NOT_FOUND');
  END IF;

  -- An existing unfinished order already reserved this coupon. Return its
  -- stored amount so refresh/retry resumes the same checkout, not a new one.
  SELECT o.* INTO v_pending_order
  FROM public.coupon_redemptions r
  JOIN public.orders o ON o.id = r.order_id
  WHERE r.coupon_id = c.id
    AND r.customer_id = auth.uid()
    AND o.product_id = p_product_id
    AND upper(trim(COALESCE(o.coupon_code, ''))) = upper(trim(c.code))
    AND o.payment_status::text <> 'verified'
    AND o.order_status::text NOT IN ('cancelled', 'delivered')
    AND (
      (o.payment_gateway = 'razorpay' AND o.razorpay_status IN ('creating', 'created', 'failed'))
      OR
      (o.payment_gateway <> 'razorpay' AND o.payment_status::text IN ('pending', 'submitted'))
    )
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'valid', true,
      'couponId', c.id,
      'code', c.code,
      'label', c.public_label,
      'discountType', c.discount_type,
      'discountValue', c.discount_value,
      'discountAmount', COALESCE(v_pending_order.coupon_discount, 0),
      'total', v_pending_order.amount,
      'stackable', c.stackable,
      'checkoutPending', true,
      'checkoutOrderId', v_pending_order.id,
      'checkoutDetails', jsonb_build_object(
        'fullName', v_pending_order.full_name,
        'email', v_pending_order.email,
        'whatsapp', v_pending_order.whatsapp,
        'deliveryAddress', v_pending_order.delivery_address,
        'deliveryCity', v_pending_order.delivery_city,
        'deliveryState', v_pending_order.delivery_state,
        'deliveryPostalCode', v_pending_order.delivery_postal_code,
        'deliveryCountry', v_pending_order.delivery_country
      )
    );
  END IF;

  IF c.status NOT IN ('ACTIVE', 'SCHEDULED')
     OR (c.status = 'SCHEDULED' AND (c.starts_at IS NULL OR c.starts_at > now()))
     OR (c.starts_at IS NOT NULL AND c.starts_at > now())
     OR (c.ends_at IS NOT NULL AND c.ends_at <= now()) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'COUPON_EXPIRED');
  END IF;

  IF c.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO v_customer_uses
    FROM public.coupon_redemptions r
    WHERE r.coupon_id = c.id
      AND r.customer_id = auth.uid();

    IF v_customer_uses >= c.per_customer_limit THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.coupon_redemptions r
        JOIN public.orders o ON o.id = r.order_id
        WHERE r.coupon_id = c.id
          AND r.customer_id = auth.uid()
          AND o.payment_status::text <> 'verified'
          AND o.order_status::text NOT IN ('cancelled', 'delivered')
          AND (
            (o.payment_gateway = 'razorpay' AND o.razorpay_status IN ('creating', 'created', 'failed'))
            OR
            (o.payment_gateway <> 'razorpay' AND o.payment_status::text IN ('pending', 'submitted'))
          )
      ) INTO v_has_pending_other;

      IF v_has_pending_other THEN
        RETURN jsonb_build_object('valid', false, 'error', 'COUPON_CHECKOUT_PENDING');
      ELSIF c.per_customer_limit = 1 THEN
        RETURN jsonb_build_object('valid', false, 'error', 'COUPON_ALREADY_USED');
      ELSE
        RETURN jsonb_build_object('valid', false, 'error', 'COUPON_CUSTOMER_LIMIT_REACHED');
      END IF;
    END IF;
  END IF;

  IF c.total_usage_limit IS NOT NULL AND c.usage_count >= c.total_usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'USAGE_LIMIT_REACHED');
  END IF;

  IF p_subtotal < c.min_subtotal THEN
    RETURN jsonb_build_object('valid', false, 'error', 'MIN_SUBTOTAL_NOT_MET');
  END IF;

  IF c.first_order_only THEN
    SELECT count(*) INTO v_prior_orders
    FROM public.orders o
    WHERE o.user_id = auth.uid()
      AND o.order_status::text <> 'cancelled';

    IF v_prior_orders > 0 THEN
      RETURN jsonb_build_object('valid', false, 'error', 'NOT_ELIGIBLE_FOR_CART');
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.coupon_targets t
    WHERE t.coupon_id = c.id AND t.mode = 'INCLUDE'
      AND (
        t.target_type = 'ALL_PRODUCTS'
        OR (t.target_type = 'PRODUCT' AND t.target_id = p_product_id)
        OR (t.target_type = 'CATEGORY' AND t.target_id = (
          SELECT category_id FROM public.products WHERE id = p_product_id
        ))
      )
  ) INTO v_eligible;

  SELECT EXISTS (
    SELECT 1 FROM public.coupon_targets t
    WHERE t.coupon_id = c.id AND t.mode = 'EXCLUDE'
      AND (
        t.target_type = 'ALL_PRODUCTS'
        OR (t.target_type = 'PRODUCT' AND t.target_id = p_product_id)
        OR (t.target_type = 'CATEGORY' AND t.target_id = (
          SELECT category_id FROM public.products WHERE id = p_product_id
        ))
      )
  ) INTO v_excluded;

  IF NOT v_eligible OR v_excluded THEN
    RETURN jsonb_build_object('valid', false, 'error', 'NOT_ELIGIBLE_FOR_CART');
  END IF;

  v_discount := CASE
    WHEN c.discount_type = 'PERCENTAGE' THEN
      round(least(p_subtotal, p_subtotal * c.discount_value / 100, COALESCE(c.max_discount_amount, p_subtotal)), 2)
    WHEN c.discount_type = 'FIXED_AMOUNT' THEN
      round(least(p_subtotal, c.discount_value), 2)
    ELSE 0
  END;

  RETURN jsonb_build_object(
    'valid', true,
    'couponId', c.id,
    'code', c.code,
    'label', c.public_label,
    'discountType', c.discount_type,
    'discountValue', c.discount_value,
    'discountAmount', v_discount,
    'total', greatest(0, round(p_subtotal - v_discount, 2)),
    'stackable', c.stackable
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO authenticated;

-- Keep the database trigger authoritative during concurrent checkout attempts.
-- It returns the same customer-facing error rather than a generic insert failure.
CREATE OR REPLACE FUNCTION public.consume_coupon_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  c public.coupons%ROWTYPE;
  v_discount numeric(12,2);
  v_subtotal numeric(12,2);
  v_prior_orders integer;
  v_customer_uses integer;
  v_has_pending_checkout boolean;
BEGIN
  SELECT round(COALESCE(NULLIF(p.discounted_price, 0), p.price), 2)
    INTO v_subtotal
  FROM public.products p
  WHERE p.id = NEW.product_id
    AND p.is_active = true
    AND COALESCE(p.is_archived, false) = false
    AND p.is_free = false;

  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Product is not purchasable';
  END IF;

  IF NEW.coupon_code IS NULL OR trim(NEW.coupon_code) = '' THEN
    NEW.coupon_discount := 0;
    NEW.amount := v_subtotal;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL OR NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'Coupon requires an authenticated customer and product';
  END IF;

  SELECT * INTO c
  FROM public.coupons
  WHERE upper(trim(code)) = upper(trim(NEW.coupon_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COUPON_NOT_FOUND';
  END IF;

  IF c.status NOT IN ('ACTIVE', 'SCHEDULED')
     OR (c.status = 'SCHEDULED' AND (c.starts_at IS NULL OR c.starts_at > now()))
     OR (c.starts_at IS NOT NULL AND c.starts_at > now())
     OR (c.ends_at IS NOT NULL AND c.ends_at <= now()) THEN
    RAISE EXCEPTION 'COUPON_EXPIRED';
  END IF;

  IF c.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO v_customer_uses
    FROM public.coupon_redemptions r
    WHERE r.coupon_id = c.id
      AND r.customer_id = NEW.user_id;

    IF v_customer_uses >= c.per_customer_limit THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.coupon_redemptions r
        JOIN public.orders o ON o.id = r.order_id
        WHERE r.coupon_id = c.id
          AND r.customer_id = NEW.user_id
          AND o.payment_status::text <> 'verified'
          AND o.order_status::text NOT IN ('cancelled', 'delivered')
          AND (
            (o.payment_gateway = 'razorpay' AND o.razorpay_status IN ('creating', 'created', 'failed'))
            OR
            (o.payment_gateway <> 'razorpay' AND o.payment_status::text IN ('pending', 'submitted'))
          )
      ) INTO v_has_pending_checkout;

      IF v_has_pending_checkout THEN
        RAISE EXCEPTION 'COUPON_CHECKOUT_PENDING';
      ELSIF c.per_customer_limit = 1 THEN
        RAISE EXCEPTION 'COUPON_ALREADY_USED';
      ELSE
        RAISE EXCEPTION 'COUPON_CUSTOMER_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  IF c.total_usage_limit IS NOT NULL AND c.usage_count >= c.total_usage_limit THEN
    RAISE EXCEPTION 'USAGE_LIMIT_REACHED';
  END IF;

  IF v_subtotal < c.min_subtotal THEN
    RAISE EXCEPTION 'MIN_SUBTOTAL_NOT_MET';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.coupon_targets t
    WHERE t.coupon_id = c.id AND t.mode = 'INCLUDE'
      AND (
        t.target_type = 'ALL_PRODUCTS'
        OR (t.target_type = 'PRODUCT' AND t.target_id = NEW.product_id)
        OR (t.target_type = 'CATEGORY' AND t.target_id = (
          SELECT p.category_id FROM public.products p WHERE p.id = NEW.product_id
        ))
      )
  ) OR EXISTS (
    SELECT 1 FROM public.coupon_targets t
    WHERE t.coupon_id = c.id AND t.mode = 'EXCLUDE'
      AND (
        t.target_type = 'ALL_PRODUCTS'
        OR (t.target_type = 'PRODUCT' AND t.target_id = NEW.product_id)
        OR (t.target_type = 'CATEGORY' AND t.target_id = (
          SELECT p.category_id FROM public.products p WHERE p.id = NEW.product_id
        ))
      )
  ) THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE_FOR_CART';
  END IF;

  IF c.first_order_only THEN
    SELECT count(*) INTO v_prior_orders
    FROM public.orders o
    WHERE o.user_id = NEW.user_id
      AND o.order_status::text <> 'cancelled';

    IF v_prior_orders > 0 THEN
      RAISE EXCEPTION 'NOT_ELIGIBLE_FOR_CART';
    END IF;
  END IF;

  v_discount := CASE
    WHEN c.discount_type = 'PERCENTAGE' THEN
      round(least(v_subtotal, v_subtotal * c.discount_value / 100, COALESCE(c.max_discount_amount, v_subtotal)), 2)
    WHEN c.discount_type = 'FIXED_AMOUNT' THEN
      round(least(v_subtotal, c.discount_value), 2)
    ELSE 0
  END;

  NEW.coupon_code := c.code;
  NEW.coupon_discount := v_discount;
  NEW.amount := greatest(0, round(v_subtotal - v_discount, 2));
  RETURN NEW;
END;
$function$;

-- Trigger-only functions must not be callable as public RPCs.
REVOKE ALL ON FUNCTION public.consume_coupon_for_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_coupon_redemption() FROM PUBLIC, anon, authenticated;

COMMIT;
