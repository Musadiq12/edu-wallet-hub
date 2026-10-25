BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0);
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Pending', 'Payment Verified', 'Preparing Order', 'Dispatched', 'Cancelled'));
ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS order_status_history_status_check;
ALTER TABLE public.order_status_history ADD CONSTRAINT order_status_history_status_check
  CHECK (status IN ('Pending', 'Payment Verified', 'Preparing Order', 'Dispatched', 'Cancelled'));

-- Preserve legacy admin mutations. The existing admin-only RLS policy still restricts this privilege.
GRANT UPDATE ON public.orders TO authenticated;

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

  IF NOT FOUND THEN RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('status', h.status, 'timestamp', h.changed_at)
    ORDER BY h.changed_at ASC), '[]'::jsonb)
  INTO v_history
  FROM public.order_status_history h
  WHERE h.order_id = v_order.id
    AND h.status IN ('Payment Verified', 'Preparing Order', 'Dispatched');

  RETURN jsonb_build_object('order', jsonb_build_object(
    'id', v_order.id, 'product_title', v_order.product_title, 'quantity', v_order.quantity, 'amount', v_order.amount,
    'created_at', v_order.created_at, 'verified_at', v_order.verified_at, 'status', v_order.status,
    'delivery_address', concat_ws(', ', v_order.delivery_address, v_order.delivery_city,
      v_order.delivery_state, v_order.delivery_postal_code, v_order.delivery_country),
    'estimated_delivery', v_order.estimated_delivery,
    'courier_name', CASE WHEN v_order.status = 'Dispatched' THEN v_order.courier_name ELSE NULL END,
    'courier_tracking_id', CASE WHEN v_order.status = 'Dispatched' THEN v_order.courier_tracking_id ELSE NULL END,
    'courier_tracking_url', CASE WHEN v_order.status = 'Dispatched' THEN v_order.courier_tracking_url ELSE NULL END,
    'history', v_history
  ));
END;
$function$;
REVOKE ALL ON FUNCTION public.get_physical_order_tracking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_physical_order_tracking(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_physical_order_tracking(
  p_order_id uuid, p_status text,
  p_courier_name text DEFAULT NULL, p_tracking_id text DEFAULT NULL,
  p_tracking_link text DEFAULT NULL, p_estimated_delivery text DEFAULT NULL
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
  IF p_status NOT IN ('Payment Verified', 'Preparing Order', 'Dispatched') THEN
    RAISE EXCEPTION 'invalid tracking status' USING ERRCODE = '22023';
  END IF;

  SELECT o.* INTO v_order FROM public.orders o
  WHERE o.id = p_order_id AND o.product_type = 'physical'
    AND o.payment_gateway = 'razorpay' AND o.payment_status = 'verified'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verified physical order not found' USING ERRCODE = 'P0002'; END IF;

  IF p_status = v_order.status THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'status', v_order.status);
  END IF;
  IF NOT ((v_order.status = 'Pending' AND p_status = 'Payment Verified') OR
          (v_order.status = 'Payment Verified' AND p_status = 'Preparing Order') OR
          (v_order.status = 'Preparing Order' AND p_status = 'Dispatched')) THEN
    RAISE EXCEPTION 'status must move forward one stage at a time' USING ERRCODE = '22023';
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
      order_status = CASE WHEN p_status = 'Dispatched' THEN 'processing'::public.order_status ELSE 'payment_verified'::public.order_status END,
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

-- Enforce progression on physical Razorpay orders even for direct admin-client updates.
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
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  IF OLD.status = 'Pending' AND NEW.status = 'Payment Verified' THEN
    IF NEW.payment_status = 'verified' AND NEW.razorpay_status = 'paid'
       AND NEW.razorpay_signature_verified_at IS NOT NULL AND NEW.razorpay_payment_id IS NOT NULL THEN
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
       OR COALESCE(NEW.courier_tracking_url, '') !~ '^https://[^[:space:]/?#]+([/?#][^[:space:]]*)?
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history(order_id, status, changed_at, changed_by)
    VALUES (NEW.id, NEW.status, COALESCE(NEW.created_at, now()), auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history(order_id, status, changed_at, changed_by)
    VALUES (NEW.id, NEW.status, now(), auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO public.order_status_history(order_id, status, changed_at)
SELECT o.id, 'Payment Verified', COALESCE(o.verified_at, o.created_at)
FROM public.orders o
WHERE o.product_type = 'physical' AND o.payment_gateway = 'razorpay'
  AND o.payment_status = 'verified'
  AND NOT EXISTS (SELECT 1 FROM public.order_status_history h
    WHERE h.order_id = o.id AND h.status = 'Payment Verified');

COMMIT;
 THEN
      RAISE EXCEPTION 'dispatch requires courier, tracking ID, and a valid HTTPS tracking link' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'Cancelled' AND NEW.order_status = 'cancelled' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'physical Razorpay order statuses must move forward one stage at a time' USING ERRCODE = '22023';
END;
$function$;

DROP TRIGGER IF EXISTS guard_physical_order_tracking_status_trigger ON public.orders;
CREATE TRIGGER guard_physical_order_tracking_status_trigger
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_physical_order_tracking_status();

CREATE OR REPLACE FUNCTION public.record_order_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history(order_id, status, changed_at, changed_by)
    VALUES (NEW.id, NEW.status, COALESCE(NEW.created_at, now()), auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history(order_id, status, changed_at, changed_by)
    VALUES (NEW.id, NEW.status, now(), auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO public.order_status_history(order_id, status, changed_at)
SELECT o.id, 'Payment Verified', COALESCE(o.verified_at, o.created_at)
FROM public.orders o
WHERE o.product_type = 'physical' AND o.payment_gateway = 'razorpay'
  AND o.payment_status = 'verified'
  AND NOT EXISTS (SELECT 1 FROM public.order_status_history h
    WHERE h.order_id = o.id AND h.status = 'Payment Verified');

COMMIT;
