-- Product publishing/archive metadata
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Public may only read active, non-archived products
DROP POLICY IF EXISTS "public read active products" ON public.products;
CREATE POLICY "public read active products" ON public.products
  FOR SELECT
  TO anon, authenticated
  USING ((is_active AND NOT is_archived) OR has_role(auth.uid(), 'admin'::app_role));

-- Editable site settings (brand, contact, UPI, socials)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admin manage settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

DROP TRIGGER IF EXISTS site_settings_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();