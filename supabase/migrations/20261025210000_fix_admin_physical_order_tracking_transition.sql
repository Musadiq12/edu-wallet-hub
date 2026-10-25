-- Repair inverted transition guard that blocked valid physical-order status changes.
CREATE OR REPLACE FUNCTION public.admin_update_physical_order_tracking(
  p_order_id uuid,
  p_status text,
  p_courier_name text DEFAULT NULL,
  p_tracking_id text DEFAULT NULL,
  p_tracking_link text DEFAULT NULL,
  p_estimated_delivery text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_url text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  -- Payment Verified is only set by the server-side Razorpay verifier.
  IF p_status NOT IN ('Preparing Order', 'Dispatched') THEN
    RAISE EXCEPTION 'invalid tracking status' USING ERRCODE = '22023';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.product_type = 'physical'
    AND o.payment_gateway = 'razorpay'
    AND o.payment_status = 'verified'
    AND o.razorpay_status IN ('paid', 'fulfilled')
    AND o.razorpay_signature_verified_at IS NOT NULL
    AND o.razorpay_payment_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verified physical Razorpay order not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_status = v_order.status THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'status', v_order.status);
  END IF;

  -- Allow only the next sequential stage.
  IF NOT (
    (v_order.status = 'Payment Verified' AND p_status = 'Preparing Order')
    OR
    (v_order.status = 'Preparing Order' AND p_status = 'Dispatched')
  ) THEN
    RAISE EXCEPTION 'status must move forward one stage at a time: Payment Verified -> Preparing Order -> Dispatched'
      USING ERRCODE = '22023';
  END IF;

  IF p_status = 'Dispatched' THEN
    IF length(trim(COALESCE(p_courier_name, ''))) NOT BETWEEN 1 AND 120
       OR length(trim(COALESCE(p_tracking_id, ''))) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'courier name and tracking ID are required' USING ERRCODE = '22023';
    END IF;

    v_url := trim(COALESCE(p_tracking_link, ''));
    IF v_url !~ '^https://[^[:space:]/?#]+([/?#][^[:space:]]*)?$' THEN
      RAISE EXCEPTION 'tracking link must be a valid https URL' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.orders
  SET status = p_status,
      order_status = CASE
        WHEN p_status = 'Dispatched' THEN 'processing'::public.order_status
        ELSE 'payment_verified'::public.order_status
      END,
      courier_name = CASE WHEN p_status = 'Dispatched' THEN trim(p_courier_name) ELSE courier_name END,
      courier_tracking_id = CASE WHEN p_status = 'Dispatched' THEN trim(p_tracking_id) ELSE courier_tracking_id END,
      courier_tracking_url = CASE WHEN p_status = 'Dispatched' THEN v_url ELSE courier_tracking_url END,
      dispatched_at = CASE WHEN p_status = 'Dispatched' THEN now() ELSE dispatched_at END,
      estimated_delivery = COALESCE(NULLIF(trim(p_estimated_delivery), ''), estimated_delivery)
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_physical_order_tracking(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_physical_order_tracking(uuid, text, text, text, text, text) TO authenticated;
