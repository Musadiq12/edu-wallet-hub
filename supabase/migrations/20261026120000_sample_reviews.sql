-- Admin-managed sample reviews are visually disclosed and excluded from real ratings.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

-- Sample reviews are read-only to the public; admins manage them using existing admin RLS.
DROP POLICY IF EXISTS "public read approved reviews" ON public.reviews;
CREATE POLICY "public read approved reviews" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING ((status = 'approved' AND is_sample = false) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "verified buyers can insert own review" ON public.reviews;
CREATE POLICY "verified buyers can insert own review" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND status = 'pending' AND is_sample = false
    AND public.has_verified_purchase(product_id)
  );

DROP POLICY IF EXISTS "users can update own pending review" ON public.reviews;
CREATE POLICY "users can update own pending review" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending' AND is_sample = false)
  WITH CHECK (
    auth.uid() = user_id AND status = 'pending' AND is_sample = false
    AND public.has_verified_purchase(product_id)
  );

DROP POLICY IF EXISTS "users can delete own pending review" ON public.reviews;
CREATE POLICY "users can delete own pending review" ON public.reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending' AND is_sample = false);

CREATE INDEX IF NOT EXISTS reviews_product_sample_status_idx
  ON public.reviews (product_id, is_sample, status, created_at DESC);
