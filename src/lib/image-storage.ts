import { supabase } from "@/integrations/supabase/client";

const R2_WORKER_URL = (
  import.meta.env["VITE_R2_WORKER_URL"] ||
  "https://edu-wallet-r2.designeroutletmedia.workers.dev"
).replace(/\/$/, "");

/**
 * New cover images are stored in R2 under covers/. Older records keep their
 * original Supabase path until they are explicitly migrated.
 */
export function publicImageUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("covers/")) {
    return `${R2_WORKER_URL}/image?key=${encodeURIComponent(path)}`;
  }
  return supabase.storage.from(bucket).getPublicUrl(path).data?.publicUrl ?? null;
}
