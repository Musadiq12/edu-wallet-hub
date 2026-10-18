-- Align settings writes with the admin authorization used by the current dashboard.
-- Existing policies may use the legacy user_roles-only check while the live dashboard
-- also supports active admin_users records.
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

DROP POLICY IF EXISTS "admin manage settings" ON public.site_settings;
DROP POLICY IF EXISTS "staff manage settings" ON public.site_settings;

CREATE POLICY "staff manage settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.is_admin_staff())
  WITH CHECK (public.is_admin_staff());

-- Existing public-read policies remain unchanged.
