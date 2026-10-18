-- Avoid recursive RLS evaluation in site_settings writes.
-- has_role is SECURITY DEFINER and safely checks the current user's admin role.
DROP POLICY IF EXISTS "staff manage settings" ON public.site_settings;
DROP POLICY IF EXISTS "admin manage settings via role" ON public.site_settings;

CREATE POLICY "admin manage settings via role" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
