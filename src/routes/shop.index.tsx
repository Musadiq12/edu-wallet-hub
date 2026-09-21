import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, LoadingGrid } from "@/components/EmptyState";
import { categoriesQuery, matchesSearch, productsQuery } from "@/lib/catalog";
import { siteConfig } from "@/config/site";

type ShopSearch = { q?: string; category?: string };

export const Route = createFileRoute("/shop/")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search['q'] === "string" && search['q'] ? search['q'] : undefined,
    category:
      typeof search['category'] === "string" && search['category'] ? search['category'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: `IGNOU Study Resources — ${siteConfig.brandName}` },
      {
        name: "description",
        content:
          "Browse IGNOU notes, guess papers, assignment guidance and exam guides. Search by subject, course or keyword.",
      },
      { property: "og:title", content: `IGNOU Study Resources — ${siteConfig.brandName}` },
      {
        property: "og:description",
        content: "Browse IGNOU notes, guess papers, assignment guidance and exam guides.",
      },
    ],
    links: [{ rel: "canonical", href: "/shop" }],
  }),
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
    if (activeCategory !== "all" && activeCategory !== "free-resources" && cat?.slug !== activeCategory)
      return false;
    return matchesSearch(p, term, cat?.name);
  });

  const setCategory = (slug: string) =>
    navigate({
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
        <h1 className="text-3xl font-bold sm:text-4xl">IGNOU Study Resources</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Notes, guess papers, assignment guidance and exam guides. All resources are digital
          (PDF) and delivered after payment verification.
        </p>

        <div className="mt-6">
          <label htmlFor="shop-search" className="sr-only">
            Search resources
          </label>
          <Input
            id="shop-search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search notes, subjects, courses..."
            className="h-12 max-w-xl"
          />
        </div>

        <div className="mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setCategory(t.slug)}
              aria-pressed={activeCategory === t.slug}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === t.slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {products.isLoading ? (
            <LoadingGrid count={8} />
          ) : products.isError ? (
            <EmptyState
              title="We couldn't load resources"
              description="Please refresh the page and try again."
            />
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : term ? (
            <EmptyState title="No resources found" description="Try another search term." />
          ) : (
            <EmptyState
              title="Resources are being added soon"
              description="Check back shortly."
              action={
                <Link to="/free-resources" className="text-sm font-medium text-primary hover:underline">
                  Browse free resources
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
