export const BRAND = "EduWallet";

/**
 * Normalize editorial title/description text without changing numeric ranges or
 * lowercase URL slugs such as "atomic-habits".
 */
export function sanitizeText(s: string): string {
  return s
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/[–—]/g, " – ")
    .replace(/\s*[-]\s*/g, (match, offset: number, whole: string) => {
      const before = whole[offset - 1] ?? "";
      const after = whole[offset + match.length] ?? "";
      if (!/\w/.test(before) || !/\w/.test(after)) return " – ";
      // Keep numeric ranges (2024-2025) and lowercase slug-like compounds.
      if (/\d/.test(before) && /\d/.test(after)) return "-";
      const left = whole.slice(0, offset).match(/[A-Za-z]+$/)?.[0] ?? "";
      const right = whole.slice(offset + match.length).match(/^[A-Za-z]+/)?.[0] ?? "";
      if (left && right && left === left.toLowerCase() && right === right.toLowerCase()) return "-";
      return " – ";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildTitle(parts: Array<string | undefined | null>, maxLen = 60): string {
  const segments = parts
    .filter((part): part is string => Boolean(part))
    .map((part) => sanitizeText(part.replace(/\\s*\\|\\s*EduWallet(?:\\s+Hub)?\\s*$/i, "")))
    .filter(Boolean);
  if (!segments.length) return BRAND;

  // The final segment is always the brand; trim other context in the requested
  // order, then shorten an unusually long remaining segment as a last resort.
  const requestedBrand = segments.pop() || BRAND;
  const brand = /eduwallet/i.test(requestedBrand) ? BRAND : requestedBrand;
  let titleParts = segments;
  const compose = () => [...titleParts, brand].filter(Boolean).join(" | ");

  if (compose().length > maxLen && titleParts.length >= 2) {
    titleParts = titleParts.filter((_, index) => index !== titleParts.length - 1);
  }
  if (compose().length > maxLen && titleParts.length > 1) {
    titleParts = titleParts.slice(1);
  }
  if (compose().length > maxLen && titleParts.length === 1) {
    const available = Math.max(1, maxLen - brand.length - 3);
    const shortened = titleParts[0].slice(0, available).trimEnd();
    titleParts = shortened ? [shortened] : [];
  }

  let title = compose().replace(/\s*\|\s*/g, " | ").replace(/\|{2,}/g, "|").trim();
  title = title.replace(/(?:\s*\|\s*)+$/, "");
  if (title.length > maxLen) title = brand.slice(0, maxLen);
  return title;
}

export function buildMeta(text: string, maxLen = 158): string {
  const clean = sanitizeText(text);
  if (clean.length <= maxLen) return clean;
  const limit = Math.max(0, maxLen - 1);
  const boundary = clean.slice(0, limit + 1).lastIndexOf(" ");
  const cutAt = boundary > 0 ? boundary : limit;
  return `${clean.slice(0, cutAt).trimEnd().replace(/[.,;:!?-]+$/, "")}.`;
}

export const SITE_URL = "https://eduwallethub.in";

/** Single source of truth for canonical, social, and structured-data URLs. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}
