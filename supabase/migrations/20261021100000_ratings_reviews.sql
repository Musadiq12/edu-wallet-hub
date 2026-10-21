-- Ratings and reviews. The SECURITY DEFINER helpers mirror this repo's has_role() authorization.
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS reviews_product_status_idx ON public.reviews (product_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.has_verified_purchase(p_product_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN auth.uid() <> p_user_id THEN public.has_role(auth.uid(), 'admin'::public.app_role)
    ELSE EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = p_user_id
        AND o.product_id = p_product_id
        AND o.payment_status = 'verified'
        AND o.order_status IN ('payment_verified', 'processing', 'delivered')
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.has_verified_purchase(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_verified_purchase(uuid, uuid) TO authenticated;

-- Public visitors only read approved reviews; authenticated authors may also read their own status.
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "users read own reviews" ON public.reviews;
CREATE POLICY "public read approved reviews" ON public.reviews
  FOR SELECT TO anon, authenticated USING (status = 'approved' OR auth.uid() = user_id);
DROP POLICY IF EXISTS "verified buyers can insert own review" ON public.reviews;
CREATE POLICY "verified buyers can insert own review" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND status = 'pending'
    AND public.has_verified_purchase(product_id, auth.uid())
  );
DROP POLICY IF EXISTS "users can update own pending review" ON public.reviews;
CREATE POLICY "users can update own pending review" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending'
    AND public.has_verified_purchase(product_id, auth.uid()));
DROP POLICY IF EXISTS "users can delete own pending review" ON public.reviews;
CREATE POLICY "users can delete own pending review" ON public.reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND status = 'pending');
DROP POLICY IF EXISTS "admin full access reviews" ON public.reviews;
CREATE POLICY "admin full access reviews" ON public.reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
