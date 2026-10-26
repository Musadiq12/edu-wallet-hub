-- Remove the abandoned sample-review feature and restore customer-review policies.
DELETE FROM public.reviews WHERE is_sample = true;

DROP POLICY IF EXISTS "public read approved reviews" ON public.reviews;
CREATE POLICY "public read approved reviews" ON public.reviews
  FOR SELECT TO anon, authenticated USING (status = 'approved' OR auth.uid() = user_id);

DROP POLICY IF EXISTS "verified buyers can insert own review" ON public.reviews;
CREATE POLICY "verified buyers can insert own review" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND status = 'pending' AND public.has_verified_purchase(product_id)
  );

DROP POLICY IF EXISTS "users can update own pending review" ON public.reviews;
CREATE POLICY "users can update own pending review" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND public.has_verified_purchase(product_id));

DROP POLICY IF EXISTS "users can delete own pending review" ON public.reviews;
CREATE POLICY "users can delete own pending review" ON public.reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "admin full access reviews" ON public.reviews;
CREATE POLICY "admin full access reviews" ON public.reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP INDEX IF EXISTS public.reviews_product_sample_status_idx;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS is_sample;
