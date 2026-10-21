-- Aggregate sales metrics in Postgres; never return raw order rows to the browser.
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
    count(*) FILTER (WHERE lower(o.payment_status::text) <> 'verified' AND lower(o.order_status::text) <> 'cancelled'),
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