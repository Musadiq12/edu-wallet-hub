const DEFAULT_SITE_URL = "https://edu-wallet-hub.designeroutletmedia.workers.dev";

/** Build absolute URLs for canonical and social metadata. Set SITE_URL when a custom domain is configured. */
export function absoluteUrl(path: string): string {
  const base = (
    process.env["SITE_URL"] ??
    import.meta.env["VITE_SITE_URL"] ??
    DEFAULT_SITE_URL
  ).replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}
