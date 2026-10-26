-- Allow signed-in users to review free products without a purchase.
-- Paid products still require a verified purchase.
CREATE OR REPLACE FUNCTION public.can_review_product(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = p_product_id AND p.is_free = true
    ) OR public.has_verified_purchase(p_product_id)
  END;
$$;

REVOKE ALL ON FUNCTION public.can_review_product(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_product(uuid) TO authenticated;

DROP POLICY IF EXISTS "verified buyers can insert own review" ON public.reviews;
CREATE POLICY "verified buyers can insert own review" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND status = 'pending' AND public.can_review_product(product_id)
  );

DROP POLICY IF EXISTS "users can update own pending review" ON public.reviews;
CREATE POLICY "users can update own pending review" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND public.can_review_product(product_id));
