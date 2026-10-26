import { absoluteUrl, BRAND } from "@/lib/seo";

type JsonLd = Record<string, unknown>;

export function getOrganizationLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: BRAND,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/edu-wallet-icon.svg"),
    description: "Exam study notes, solved papers and study resources for competitive, board and entrance exams in India.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: absoluteUrl("/contact"),
      availableLanguage: ["en", "hi"],
    },
  };
}

export function getWebsiteLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    url: absoluteUrl("/"),
    name: BRAND,
    publisher: { "@id": absoluteUrl("/#organization") },
    inLanguage: "en-IN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/shop?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

function humanizeSlug(slug: string): string {
  const known: Record<string, string> = {
    "marrow-8-0-rr-full-set": "Marrow 8.0 RR Full Set",
    "how-to-prepare-for-competitive-exams-neet-jee-upsc-ssc-cgl-banking": "How to Prepare for Competitive Exams",
  };
  if (known[slug]) return known[slug];
  return slug
    .split("-")
    .map((word) => /^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Build breadcrumbs for the visible route. Optional pageName should match the page's visible heading/breadcrumb label. */
export function getBreadcrumbLd(route: string, pageName?: string): JsonLd | null {
  const path = route.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  if (path === "/") return null;

  const crumbs: Array<{ name: string; path: string }> = [{ name: "Home", path: "/" }];
  if (path === "/shop") {
    crumbs.push({ name: "Shop", path: "/shop" });
  } else if (path.startsWith("/shop/")) {
    crumbs.push({ name: "Shop", path: "/shop" });
    crumbs.push({ name: pageName || humanizeSlug(path.slice("/shop/".length)), path });
  } else if (path === "/blog") {
    crumbs.push({ name: "Blog", path: "/blog" });
  } else if (path.startsWith("/blog/")) {
    crumbs.push({ name: "Blog", path: "/blog" });
    crumbs.push({ name: pageName || humanizeSlug(path.slice("/blog/".length)), path });
  } else {
    const names: Record<string, string> = {
      "/about": "About",
      "/contact": "Contact",
      "/terms": "Terms & Conditions",
      "/privacy": "Privacy Policy",
    };
    crumbs.push({ name: pageName || names[path] || humanizeSlug(path.replace(/^\//, "")), path });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}
