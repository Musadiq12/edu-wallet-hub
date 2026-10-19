-- Transactional reset support for the admin dashboard.
-- Attempt rows are kept separately from sales data so rate limiting survives resets.
CREATE TABLE IF NOT EXISTS public.admin_reset_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  ip_address inet,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_reset_attempts_actor_time_idx
  ON public.admin_reset_attempts (actor_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS admin_reset_attempts_ip_time_idx
  ON public.admin_reset_attempts (ip_address, attempted_at DESC);

ALTER TABLE public.admin_reset_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_reset_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_reset_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.admin_reset_guard(
  p_actor_id uuid,
  p_ip_address inet
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt_count integer;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor required' USING ERRCODE = '22023';
  END IF;

  -- Serialize attempts per account+IP so concurrent requests cannot bypass the limit.
  PERFORM pg_advisory_xact_lock(hashtext(p_actor_id::text || ':' || coalesce(p_ip_address::text, 'unknown')));

  DELETE FROM public.admin_reset_attempts
   WHERE attempted_at < now() - interval '24 hours';

  SELECT count(*)::integer INTO v_attempt_count
    FROM public.admin_reset_attempts
   WHERE actor_id = p_actor_id
     AND ip_address IS NOT DISTINCT FROM p_ip_address
     AND attempted_at >= now() - interval '15 minutes';

  IF v_attempt_count >= 5 THEN
    RETURN false;
  END IF;

  INSERT INTO public.admin_reset_attempts (actor_id, ip_address, attempted_at)
  VALUES (p_actor_id, p_ip_address, now());

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_guard(uuid, inet) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_guard(uuid, inet) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_reset_dashboard(
  p_actor_id uuid,
  p_ip_address inet,
  p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orders_deleted integer := 0;
  v_invoices_deleted integer := 0;
  v_enrollments_unlinked integer := 0;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor required' USING ERRCODE = '22023';
  END IF;

  -- Delete sales records before their parent orders. The function call is one
  -- Postgres transaction; an error also rolls back its audit entry.
  DELETE FROM public.order_status_history;
  DELETE FROM public.invoices;
  GET DIAGNOSTICS v_invoices_deleted = ROW_COUNT;

  UPDATE public.enrollments
     SET order_id = NULL,
         updated_at = now()
   WHERE order_id IS NOT NULL;
  GET DIAGNOSTICS v_enrollments_unlinked = ROW_COUNT;

  DELETE FROM public.orders;
  GET DIAGNOSTICS v_orders_deleted = ROW_COUNT;

  INSERT INTO public.admin_activity_logs
    (actor_id, action, entity_type, before_data, after_data, ip_address, user_agent, created_at)
  VALUES
    (p_actor_id, 'reset_dashboard', 'sales_data',
     jsonb_build_object(
       'orders_deleted', v_orders_deleted,
       'invoices_deleted', v_invoices_deleted,
       'enrollments_unlinked', v_enrollments_unlinked
     ),
     jsonb_build_object('orders_remaining', 0, 'revenue_remaining', 0),
     p_ip_address, left(coalesce(p_user_agent, ''), 1000), now());

  RETURN jsonb_build_object(
    'ok', true,
    'ordersDeleted', v_orders_deleted,
    'invoicesDeleted', v_invoices_deleted,
    'enrollmentsUnlinked', v_enrollments_unlinked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_dashboard(uuid, inet, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_dashboard(uuid, inet, text) TO service_role;
