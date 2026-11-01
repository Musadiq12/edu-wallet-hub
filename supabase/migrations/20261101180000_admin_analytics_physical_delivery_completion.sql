-- Correct payment-verification counts and complete physical order delivery safely.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_sales_stats(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_is_admin boolean;
  v_revenue numeric;
  v_orders_total integer;
  v_orders_verified integer;
  v_orders_pending integer;
  v_orders_cancelled integer;
  v_aov numeric;
  v_series jsonb;
  v_by_status jsonb;
  v_by_payment jsonb;
  v_by_type jsonb;
  v_top_products jsonb;
BEGIN
  SELECT public.is_admin_staff() INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'administrator access required';
  END IF;

  SELECT
    COALESCE(sum(o.amount) FILTER (WHERE lower(o.payment_status::text) = 'verified' AND lower(o.order_status::text) <> 'cancelled'), 0),
    count(*),
    count(*) FILTER (WHERE lower(o.payment_status::text) = 'verified' AND lower(o.order_status::text) <> 'cancelled'),
    count(*) FILTER (WHERE lower(o.payment_status::text) IN ('pending', 'submitted') AND lower(o.order_status::text) <> 'cancelled'),
    count(*) FILTER (WHERE lower(o.order_status::text) = 'cancelled')
  INTO v_revenue, v_orders_total, v_orders_verified, v_orders_pending, v_orders_cancelled
  FROM public.orders o
  WHERE o.created_at >= p_from AND o.created_at < p_to;

  v_aov := CASE WHEN v_orders_verified > 0 THEN round(v_revenue / v_orders_verified, 2) ELSE 0 END;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.day), '[]'::jsonb) INTO v_series
  FROM (
    SELECT date_trunc('day', o.created_at)::date AS day,
      COALESCE(sum(o.amount) FILTER (WHERE lower(o.payment_status::text) = 'verified' AND lower(o.order_status::text) <> 'cancelled'), 0) AS revenue,
      count(*) AS orders
    FROM public.orders o
    WHERE o.created_at >= p_from AND o.created_at < p_to
    GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.value DESC), '[]'::jsonb) INTO v_by_status
  FROM (SELECT o.order_status::text AS label, count(*) AS value FROM public.orders o
    WHERE o.created_at >= p_from AND o.created_at < p_to GROUP BY 1) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.value DESC), '[]'::jsonb) INTO v_by_payment
  FROM (SELECT o.payment_status::text AS label, count(*) AS value FROM public.orders o
    WHERE o.created_at >= p_from AND o.created_at < p_to GROUP BY 1) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.label), '[]'::jsonb) INTO v_by_type
  FROM (
    SELECT COALESCE(NULLIF(o.product_type, ''), 'other') AS label, count(*) AS orders,
      COALESCE(sum(o.amount) FILTER (WHERE lower(o.payment_status::text) = 'verified' AND lower(o.order_status::text) <> 'cancelled'), 0) AS revenue
    FROM public.orders o WHERE o.created_at >= p_from AND o.created_at < p_to GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.revenue DESC), '[]'::jsonb) INTO v_top_products
  FROM (
    SELECT COALESCE(NULLIF(o.product_title, ''), 'Deleted product') AS title,
      count(*) AS units, COALESCE(sum(o.amount), 0) AS revenue
    FROM public.orders o
    WHERE o.created_at >= p_from AND o.created_at < p_to
      AND lower(o.payment_status::text) = 'verified' AND lower(o.order_status::text) <> 'cancelled'
    GROUP BY 1 ORDER BY revenue DESC LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'revenue', v_revenue, 'ordersTotal', v_orders_total,
    'ordersVerified', v_orders_verified, 'ordersPending', v_orders_pending,
    'ordersCancelled', v_orders_cancelled, 'aov', v_aov,
    'series', v_series, 'byStatus', v_by_status, 'byPayment', v_by_payment,
    'byType', v_by_type, 'topProducts', v_top_products
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sales_stats(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sales_stats(timestamptz, timestamptz) TO authenticated;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Pending', 'Payment Verified', 'Preparing Order', 'Dispatched', 'Delivered', 'Cancelled'));

ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS order_status_history_status_check;
ALTER TABLE public.order_status_history ADD CONSTRAINT order_status_history_status_check
  CHECK (status IN ('Pending', 'Payment Verified', 'Preparing Order', 'Dispatched', 'Delivered', 'Cancelled'));

CREATE OR REPLACE FUNCTION public.get_physical_order_tracking(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_history jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.user_id = v_user_id
    AND o.product_type = 'physical' AND o.payment_status = 'verified'
    AND o.payment_gateway = 'razorpay';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('status', h.status, 'timestamp', h.changed_at)
    ORDER BY h.changed_at ASC), '[]'::jsonb)
  INTO v_history
  FROM public.order_status_history h
  WHERE h.order_id = v_order.id
    AND h.status IN ('Payment Verified', 'Preparing Order', 'Dispatched', 'Delivered');

  RETURN jsonb_build_object('order', jsonb_build_object(
    'id', v_order.id, 'product_title', v_order.product_title, 'quantity', v_order.quantity,
    'amount', v_order.amount, 'created_at', v_order.created_at, 'verified_at', v_order.verified_at,
    'delivered_at', v_order.delivered_at, 'status', v_order.status,
    'delivery_address', concat_ws(', ', v_order.delivery_address, v_order.delivery_city,
      v_order.delivery_state, v_order.delivery_postal_code, v_order.delivery_country),
    'estimated_delivery', v_order.estimated_delivery,
    'courier_name', CASE WHEN v_order.status IN ('Dispatched', 'Delivered') THEN v_order.courier_name ELSE NULL END,
    'courier_tracking_id', CASE WHEN v_order.status IN ('Dispatched', 'Delivered') THEN v_order.courier_tracking_id ELSE NULL END,
    'courier_tracking_url', CASE WHEN v_order.status IN ('Dispatched', 'Delivered') THEN v_order.courier_tracking_url ELSE NULL END,
    'history', v_history
  ));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_physical_order_tracking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_physical_order_tracking(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_physical_orders()
RETURNS TABLE(order_id uuid, product_title text, amount numeric, created_at timestamptz, status text, estimated_delivery text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    o.id,
    o.product_title,
    o.amount::numeric,
    o.created_at,
    o.status,
    o.estimated_delivery
  FROM public.orders AS o
  WHERE o.user_id = auth.uid()
    AND o.product_type = 'physical'
    AND o.payment_gateway = 'razorpay'
    AND o.payment_status = 'verified'
    AND o.razorpay_status IN ('paid', 'fulfilled')
    AND o.razorpay_payment_id IS NOT NULL
    AND o.razorpay_signature_verified_at IS NOT NULL
    AND o.status IN ('Payment Verified', 'Preparing Order', 'Dispatched', 'Delivered')
  ORDER BY o.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_my_physical_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_physical_orders() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_physical_order_tracking_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF OLD.product_type <> 'physical' OR NEW.product_type <> 'physical'
     OR OLD.payment_gateway <> 'razorpay' OR NEW.payment_gateway <> 'razorpay' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'Pending' AND NEW.status = 'Payment Verified' THEN
    IF NEW.payment_status = 'verified'
       AND NEW.razorpay_status = 'paid'
       AND NEW.razorpay_signature_verified_at IS NOT NULL
       AND NEW.razorpay_payment_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Payment Confirmed requires successful server-side Razorpay verification' USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'Payment Verified' AND NEW.status = 'Preparing Order' THEN
    IF NEW.payment_status <> 'verified' OR NEW.razorpay_status NOT IN ('paid', 'fulfilled') THEN
      RAISE EXCEPTION 'payment must be verified before preparation' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'Preparing Order' AND NEW.status = 'Dispatched' THEN
    IF length(trim(COALESCE(NEW.courier_name, ''))) NOT BETWEEN 1 AND 120
       OR length(trim(COALESCE(NEW.courier_tracking_id, ''))) NOT BETWEEN 1 AND 120
       OR COALESCE(NEW.courier_tracking_url, '') !~ '^https://[^[:space:]/?#]+([/?#][^[:space:]]*)?$' THEN
      RAISE EXCEPTION 'dispatch requires courier, tracking ID, and a valid HTTPS tracking link' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'Dispatched' AND NEW.status = 'Delivered' THEN
    IF OLD.dispatched_at IS NOT NULL
       AND NEW.delivered_at IS NOT NULL
       AND NEW.order_status = 'delivered'
       AND NEW.payment_status = 'verified'
       AND NEW.razorpay_status IN ('paid', 'fulfilled')
       AND NEW.razorpay_payment_id IS NOT NULL
       AND NEW.razorpay_signature_verified_at IS NOT NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'only a dispatched, fully verified physical order can be marked delivered' USING ERRCODE = '22023';
  END IF;

  IF NEW.status = 'Cancelled' AND NEW.order_status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'physical Razorpay order statuses must move forward one stage at a time' USING ERRCODE = '22023';
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mark_physical_order_delivered(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status = 'Delivered' AND v_order.order_status = 'delivered' THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'status', 'Delivered');
  END IF;

  IF v_order.product_type <> 'physical'
     OR v_order.payment_gateway <> 'razorpay'
     OR v_order.payment_status <> 'verified'
     OR v_order.razorpay_status NOT IN ('paid', 'fulfilled')
     OR v_order.razorpay_signature_verified_at IS NULL
     OR v_order.razorpay_payment_id IS NULL
     OR v_order.status <> 'Dispatched'
     OR v_order.dispatched_at IS NULL THEN
    RAISE EXCEPTION 'only a dispatched, verified physical Razorpay order can be marked delivered' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = 'Delivered',
      order_status = 'delivered'::public.order_status,
      delivered_at = COALESCE(delivered_at, now())
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'status', 'Delivered');
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_mark_physical_order_delivered(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_physical_order_delivered(uuid) TO authenticated;

COMMIT;
