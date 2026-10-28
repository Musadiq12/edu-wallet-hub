import { supabase } from "@/integrations/supabase/client";

const R2_WORKER_URL = (
  import.meta.env["VITE_R2_WORKER_URL"] ||
  "https://edu-wallet-r2.designeroutletmedia.workers.dev"
).replace(/\/$/, "");

/**
 * New cover images are stored in R2 under covers/. Older records keep their
 * original Supabase path until they are explicitly migrated.
 */
export function publicImageUrl(bucket: string, path: string | null | undefined, width = 400): string | null {
  if (!path) return null;
  if (path.startsWith("covers/")) {
    const params = new URLSearchParams({ key: path, width: String(width), format: "auto" });
    return `${R2_WORKER_URL}/image?${params.toString()}`;
  }
  return supabase.storage.from(bucket).getPublicUrl(path, {
    transform: { width, quality: 78, resize: "contain" },
  }).data?.publicUrl ?? null;
}

const RESPONSIVE_WIDTHS = [320, 400, 640, 960, 1200] as const;

export function responsiveImageSrcSet(bucket: string, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return RESPONSIVE_WIDTHS.map((width) => {
    const url = publicImageUrl(bucket, path, width);
    return url ? `${url} ${width}w` : null;
  }).filter(Boolean).join(", ");
}
