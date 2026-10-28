import { supabase } from "@/integrations/supabase/client";

const R2_WORKER_URL = (
  import.meta.env["VITE_R2_WORKER_URL"] ||
  "https://edu-wallet-r2.designeroutletmedia.workers.dev"
).replace(/\/$/, "");

const RESPONSIVE_WIDTHS = [320, 400, 640, 960, 1200] as const;

/** Resolve public image URLs at the requested display width. */
export function publicImageUrl(bucket: string, path: string | null | undefined, width = 400): string | null {
  if (!path) return null;
  if (path.startsWith("covers/")) {
    const params = new URLSearchParams({ key: path, width: String(width), format: "auto" });
    return `${R2_WORKER_URL}/image?${params.toString()}`;
  }

  const original = supabase.storage.from(bucket).getPublicUrl(path).data?.publicUrl;
  if (!original) return null;
  if (bucket === "product-covers" || bucket === "blog-covers") {
    const transformed = new URL(original);
    transformed.pathname = transformed.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    transformed.searchParams.set("width", String(width));
    transformed.searchParams.set("quality", "78");
    transformed.searchParams.set("resize", "contain");
    return transformed.toString();
  }
  return original;
}

export function responsiveImageSrcSet(bucket: string, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return RESPONSIVE_WIDTHS.map((width) => {
    const url = publicImageUrl(bucket, path, width);
    return url ? `${url} ${width}w` : null;
  }).filter(Boolean).join(", ");
}
