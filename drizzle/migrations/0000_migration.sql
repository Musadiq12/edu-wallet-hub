DROP POLICY IF EXISTS "read covers" ON storage.objects;
DROP POLICY IF EXISTS "read previews" ON storage.objects;

CREATE POLICY "read covers" ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'product-covers' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.products p WHERE p.cover_image = storage.objects.name AND p.is_active AND NOT p.is_archived)
  )
);

CREATE POLICY "read previews" ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'product-previews' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.products p WHERE p.preview_file = storage.objects.name AND p.is_active AND NOT p.is_archived)
  )
);

DROP POLICY IF EXISTS "anyone can send message" ON public.contact_messages;
CREATE POLICY "anyone can send message" ON public.contact_messages FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(name)) BETWEEN 1 AND 100
  AND length(email) BETWEEN 3 AND 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (whatsapp IS NULL OR length(whatsapp) <= 20)
  AND length(btrim(message)) BETWEEN 1 AND 5000
);