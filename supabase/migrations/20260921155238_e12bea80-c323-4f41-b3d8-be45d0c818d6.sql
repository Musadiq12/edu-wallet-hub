
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- covers & previews: readable by everyone (via signed/authenticated reads), writable by admins
CREATE POLICY "read covers" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'product-covers');
CREATE POLICY "read previews" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'product-previews');
CREATE POLICY "admin write covers" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('product-covers','product-previews','product-files') AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id IN ('product-covers','product-previews','product-files') AND public.has_role(auth.uid(),'admin'));

-- payment proofs: user uploads into their own folder, only admins read
CREATE POLICY "user upload proof" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "admin read proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(),'admin'));
