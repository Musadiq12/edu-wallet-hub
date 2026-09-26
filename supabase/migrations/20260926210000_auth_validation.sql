-- Defense-in-depth profile input sanitization and length limits.
-- Supabase Auth remains responsible for authentication credentials.

CREATE OR REPLACE FUNCTION public.strip_html_tags(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_catalog
AS $
BEGIN
  RETURN btrim(
    regexp_replace(
      regexp_replace(coalesce(value, ''), '<[^>]*>', '', 'g'),
      E'[\\x00-\\x1F\\x7F]',
      '',
      'g'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name := left(public.strip_html_tags(NEW.full_name), 100);
  END IF;

  IF NEW.whatsapp IS NOT NULL THEN
    IF length(NEW.whatsapp) > 20 OR NEW.whatsapp !~ '^[0-9+()[:space:]-]+$' THEN
      RAISE EXCEPTION 'invalid profile input';
    END IF;
    NEW.whatsapp := btrim(NEW.whatsapp);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profiles_before_write ON public.profiles;
CREATE TRIGGER validate_profiles_before_write
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_fields();

-- These helpers are implementation details used by the trigger, not public RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.strip_html_tags(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_profile_fields() FROM PUBLIC, anon, authenticated;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_full_name_length'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_full_name_length CHECK (full_name IS NULL OR length(full_name) <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_whatsapp_length'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_whatsapp_length CHECK (whatsapp IS NULL OR length(whatsapp) <= 20);
  END IF;
END $$;
