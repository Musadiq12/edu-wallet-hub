CREATE OR REPLACE FUNCTION public.admin_delete_coupon(p_coupon_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_before jsonb;
BEGIN
  IF NOT public.is_admin_staff() THEN
    RAISE EXCEPTION 'administrator access required';
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = p_coupon_id)
     OR EXISTS (SELECT 1 FROM public.order_discount_allocations WHERE coupon_id = p_coupon_id) THEN
    RAISE EXCEPTION 'This coupon has order history and cannot be deleted. Disable it to prevent future use while preserving records.';
  END IF;

  v_before := to_jsonb(v_coupon);

  DELETE FROM public.coupons WHERE id = p_coupon_id;

  INSERT INTO public.activity_logs(actor_user_id, action, entity_type, entity_id, summary, before_data, after_data)
  VALUES(auth.uid(), 'delete', 'coupon', p_coupon_id, 'Deleted unused coupon ' || v_coupon.code, v_before, NULL);

  RETURN jsonb_build_object('id', p_coupon_id, 'deleted', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_coupon(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_coupon(uuid) TO authenticated;
