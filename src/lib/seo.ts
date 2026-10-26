export const SITE_URL = (
  import.meta.env["VITE_SITE_URL"] || "https://edu-wallet-hub.designeroutletmedia.workers.dev"
).replace(/\/+$/, "");

export type BreadcrumbItem = { name: string; path: string };

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export function jsonLd(value: Record<string, unknown>) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "EduWallet",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/edu-wallet-icon.svg"),
    description:
      "Exam-focused notes, solved papers, and educational resources for competitive and entrance exams.",
  };
}

export function breadcrumbJson(items: BreadcrumbItem[]) {
  return jsonLd(breadcrumbSchema(items));
}

export function organizationJson() {
  return jsonLd(organizationSchema());
}
