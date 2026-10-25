-- List only a customer's own fully verified physical Razorpay purchases for My Library.
-- Courier information remains available only through get_physical_order_tracking after dispatch.
CREATE OR REPLACE FUNCTION public.get_my_physical_orders()
RETURNS TABLE (
  order_id uuid,
  product_title text,
  amount numeric,
  created_at timestamptz,
  status text,
  estimated_delivery text
)
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
    AND o.status IN ('Payment Verified', 'Preparing Order', 'Dispatched')
  ORDER BY o.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_my_physical_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_physical_orders() TO authenticated;
