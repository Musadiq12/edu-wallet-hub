export const SITE_URL = "https://eduwallethub.in";

/** Build absolute URLs for canonical and social metadata. Set VITE_SITE_URL when a custom domain is configured. */
export function absoluteUrl(path: string): string {
  const base = SITE_URL;
  return `${base}/${path.replace(/^\/+/, "")}`;
}
