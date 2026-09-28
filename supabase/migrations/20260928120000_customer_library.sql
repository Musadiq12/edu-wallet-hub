-- Customer digital library: verified purchases grant access to the purchased PDF.
-- Access is enforced by RLS on storage.objects, not only by the frontend.

CREATE POLICY "customers read purchased product files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-files'
  AND EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.orders o ON o.product_id = p.id
    WHERE p.pdf_file = storage.objects.name
      AND o.user_id = auth.uid()
      AND o.payment_status = 'verified'
      AND o.order_status IN ('payment_verified', 'processing', 'delivered')
  )
);

-- A customer can see only their own verified purchases.
CREATE OR REPLACE VIEW public.my_library
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (o.product_id)
  o.product_id,
  p.title,
  p.slug,
  p.description,
  p.cover_image,
  p.pdf_file,
  p.page_count,
  p.format,
  o.id AS order_id,
  o.amount,
  o.verified_at,
  o.delivered_at
FROM public.orders o
JOIN public.products p ON p.id = o.product_id
WHERE o.user_id = auth.uid()
  AND o.payment_status = 'verified'
  AND o.order_status IN ('payment_verified', 'processing', 'delivered')
  AND p.pdf_file IS NOT NULL
ORDER BY o.product_id, o.verified_at DESC NULLS LAST, o.created_at DESC;

GRANT SELECT ON public.my_library TO authenticated;
