import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, LoadingGrid } from "@/components/EmptyState";
import { categoriesQuery, matchesSearch, productsQuery } from "@/lib/catalog";
import { SITE_URL } from "@/lib/seo";

type ShopSearch = { q?: string; category?: string };

export const Route = createFileRoute("/shop/")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
    category: typeof search["category"] === "string" && search["category"] ? search["category"] : undefined,
  }),
  head: ({ match }) => {
    const search = match.search as ShopSearch;
    const hasSearch = Boolean(search.q?.trim());
    const category = search.category?.trim();
    const label = hasSearch ? search.q!.trim().slice(0, 45) : category ? category.replace(/-/g, " ") : "";
    const displayLabel = label.replace(/\b\w/g, (c) => c.toUpperCase());
    const title = displayLabel ? `${displayLabel} Study Resources | EduWallet` : "Exam Study Resources and Notes | EduWallet";
    const description = displayLabel
      ? `Browse ${displayLabel} study notes, solved papers, exam guides and digital learning resources on EduWallet.`
      : "Browse exam-focused notes, solved papers, revision guides and digital study resources for competitive and entrance exams on EduWallet.";
    return {
      meta: [
        { title }, { name: "description", content: description },
        { name: "robots", content: hasSearch ? "noindex, follow" : "index, follow" },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "website" }, { property: "og:url", content: new URL("/shop", SITE_URL).toString() },
        { name: "twitter:card", content: "summary" }, { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: hasSearch ? [] : [{ rel: "canonical", href: new URL("/shop", SITE_URL).toString() }],
    };
  },
  component: Shop,
});

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(search.q ?? "");
  const products = useQuery(productsQuery());
  const categories = useQuery(categoriesQuery());
  const activeCategory = search.category ?? "all";
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const filtered = (products.data ?? []).filter((p) => {
    const cat = p.category_id ? categoryById.get(p.category_id) : undefined;
    if (activeCategory === "free-resources" && !p.is_free) return false;
    if (activeCategory !== "all" && activeCategory !== "free-resources" && cat?.slug !== activeCategory) return false;
    return matchesSearch(p, term, cat?.name);
  });
  const setCategory = (slug: string) => navigate({
    to: "/shop",
    search: { q: term || undefined, category: slug === "all" ? undefined : slug },
  });
  const tabs = [
    { slug: "all", name: "All" },
    ...(categories.data ?? []).map((c) => ({ slug: c.slug, name: c.name })),
    { slug: "free-resources", name: "Free Resources" },
  ];
  return (
    <div className="section-y">
      <div className="page-container">
        <h1 className="text-3xl font-bold sm:text-4xl">Exam Study Resources</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Browse exam-focused notes, guess papers, solved papers, revision guides, assignment guidance and other learning resources for popular Indian exams. Each listing includes product details and pricing; delivery depends on whether the item is a digital PDF or a physical product.
        </p>
        <section className="mt-4 max-w-3xl space-y-2 text-sm leading-6 text-muted-foreground" aria-labelledby="shop-guide">
          <h2 id="shop-guide" className="text-base font-semibold text-foreground">Find the right preparation resource</h2>
          <p>Search by exam, subject, course, or resource name to narrow the catalogue. Review the description, format, included content, and delivery details on a product page before placing an order.</p>
          <p>Use study materials as a supplement to the current official syllabus and exam instructions. Product availability and formats can vary by listing.</p>
        </section>
        <div className="mt-6">
          <label htmlFor="shop-search" className="sr-only">Search resources</label>
          <Input id="shop-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search notes, subjects, courses..." className="h-12 max-w-xl" />
        </div>
        <div className="hidden" role="group" aria-label="Filter resources by category">
          {tabs.map((t) => <button key={t.slug} type="button" onClick={() => setCategory(t.slug)} aria-pressed={activeCategory === t.slug}>{t.name}</button>)}
        </div>
        <div className="mt-8">
          {products.isLoading ? <LoadingGrid count={8} /> : products.isError ? (
            <EmptyState title="We couldn't load resources" description="Please refresh the page and try again." />
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{filtered.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          ) : term ? <EmptyState title="No resources found" description="Try another search term." /> : (
            <EmptyState title="Resources are being added soon" description="Check back shortly." action={<Link to="/free-resources" className="text-sm font-medium text-primary hover:underline">Browse free resources</Link>} />
          )}
        </div>
      </div>
    </div>
  );
}
