import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { categoriesQuery, matchesSearch, productsQuery } from "@/lib/catalog";
import { absoluteUrl, BRAND, buildMeta, buildTitle } from "@/lib/seo";

type ShopSearch = { q?: string | undefined; category?: string | undefined };

export const Route = createFileRoute("/shop/")({
  loader: async ({ context }) => {
    const [products, categories] = await Promise.all([
      context.queryClient.ensureQueryData(productsQuery()),
      context.queryClient.ensureQueryData(categoriesQuery()),
    ]);
    return { products, categories };
  },
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
    category:
      typeof search["category"] === "string" && search["category"] ? search["category"] : undefined,
  }),
  head: ({ match }) => {
    const search = match.search as ShopSearch;
    const term = search.q?.trim();
    const category = search.category?.trim();
    const label = term
      ? term.toUpperCase()
      : category
        ? category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "";
    const title = label
      ? buildTitle([label, "Study Resources", BRAND])
      : buildTitle(["Buy Exam Notes, Solved Papers & Study Material", BRAND]);
    const description = label
      ? buildMeta(`Browse ${label} study notes, solved papers, exam guides and digital learning resources on ${BRAND}.`)
      : "Buy exam notes, solved papers, guess papers and study material for NEET, JEE, UPSC, SSC CGL, Banking and CLAT. Compare formats and product details.";
    const isFiltered = Boolean(term || category);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: absoluteUrl("/shop") },
        { property: "og:image", content: absoluteUrl("/og-image.svg") },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: absoluteUrl("/og-image.svg") },
        ...(isFiltered ? [{ name: "robots", content: "noindex, follow" }] : []),
      ],
      links: isFiltered ? [] : [{ rel: "canonical", href: absoluteUrl("/shop") }],
    };
  },
  component: Shop,
});

function Shop() {
  const { products, categories } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(search.q ?? "");


  const activeCategory = search.category ?? "all";
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const filtered = (products ?? []).filter((p) => {
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
    ...(categories ?? []).map((c) => ({ slug: c.slug, name: c.name })),
    { slug: "free-resources", name: "Free Resources" },
  ];

  return (
    <div className="section-y">
      <div className="page-container">
        <div className="mb-6 flex flex-col gap-2 border-b border-border pb-5 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">EduWallet marketplace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Explore Study Materials</h1>
            <p className="mt-1 text-sm text-muted-foreground">Find notes, solved papers, books and exam resources.</p>
          </div>
          <p className="text-xs font-medium text-muted-foreground">NEET · JEE · UPSC · SSC · Banking · CLAT</p>
        </div>

        <div className="mt-0">
          <label htmlFor="shop-search" className="sr-only">Search resources</label>
          <Input
            id="shop-search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search notes, subjects, courses..."
            className="h-12 w-full max-w-2xl rounded-xl bg-card shadow-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter resources by category">
          {tabs.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setCategory(t.slug)}
              aria-pressed={activeCategory === t.slug}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeCategory === t.slug ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/80 bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"}`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : term ? (
            <EmptyState title="No resources found" description="Try another search term." />
          ) : (
            <EmptyState
              title="Resources are being added soon"
              description="Check back shortly."
              action={<Link to="/free-resources" className="text-sm font-medium text-primary hover:underline">Browse free resources</Link>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
