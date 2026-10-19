-- Fix reset transaction for projects with a DELETE safety guard requiring WHERE.
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

  DELETE FROM public.order_status_history WHERE true;
  DELETE FROM public.invoices WHERE true;
  GET DIAGNOSTICS v_invoices_deleted = ROW_COUNT;

  UPDATE public.enrollments
     SET order_id = NULL,
         updated_at = now()
   WHERE order_id IS NOT NULL;
  GET DIAGNOSTICS v_enrollments_unlinked = ROW_COUNT;

  DELETE FROM public.orders WHERE true;
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
