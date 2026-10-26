export const SITE_URL = "https://eduwallethub.in";

/** Single source of truth for canonical, social, and structured-data URLs. */
export function absoluteUrl(path: string): string {
  const base = SITE_URL;
  return `${base}/${path.replace(/^\/+/, "")}`;
}
