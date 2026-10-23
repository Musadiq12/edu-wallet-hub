-- Security hardening for issue #27.
-- Keep admin RPC execution restricted to authenticated callers and prevent
-- untrusted search_path resolution inside the SECURITY DEFINER function.
REVOKE EXECUTE ON FUNCTION public.admin_upsert_product(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_product(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product(uuid, jsonb) TO authenticated;
ALTER FUNCTION public.admin_upsert_product(uuid, jsonb) SET search_path = '';

-- Allow anonymous visitors to submit contact messages, but do not grant them
-- SELECT access. The API should use Prefer: return=minimal for public submits.
DROP POLICY IF EXISTS "anyone can send message" ON public.contact_messages;
CREATE POLICY "anyone can send message"
  ON public.contact_messages
  AS PERMISSIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
GRANT INSERT ON TABLE public.contact_messages TO anon, authenticated;
