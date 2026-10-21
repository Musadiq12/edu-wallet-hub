-- Subsequent migration records the security-scoped RPC signature now used by reviews.
CREATE OR REPLACE FUNCTION public.has_verified_purchase(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = auth.uid()
        AND o.product_id = p_product_id
        AND o.payment_status = 'verified'
        AND o.order_status IN ('payment_verified', 'processing', 'delivered')
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.has_verified_purchase(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_verified_purchase(uuid) TO authenticated;

DROP POLICY IF EXISTS "verified buyers can insert own review" ON public.reviews;
DROP POLICY IF EXISTS "users can update own pending review" ON public.reviews;
CREATE POLICY "verified buyers can insert own review" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND public.has_verified_purchase(product_id));
CREATE POLICY "users can update own pending review" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND public.has_verified_purchase(product_id));
