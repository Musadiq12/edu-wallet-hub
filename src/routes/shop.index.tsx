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
        <h1 className="text-3xl font-bold sm:text-4xl">Buy Exam Notes, Solved Papers and Study Material</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Buy exam notes, solved papers, guess papers, revision guides and other study resources for NEET, JEE, UPSC, SSC CGL, Banking and CLAT. Review each listing for its actual contents, format, price and delivery details before ordering.
        </p>
        <section className="mt-4 max-w-3xl space-y-2 text-sm leading-6 text-muted-foreground" aria-labelledby="shop-guide">
          <h2 id="shop-guide" className="text-base font-semibold text-foreground">Find the right preparation resource</h2>
          <p>Search by exam, subject, course, or resource name to narrow the catalogue. Review the description, format, included content, and delivery details on a product page before placing an order.</p>
          <p>Use study materials as a supplement to the current official syllabus and exam instructions. Product availability and formats can vary by listing.</p>
        </section>

        <div className="mt-6">
          <label htmlFor="shop-search" className="sr-only">Search resources</label>
          <Input
            id="shop-search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search notes, subjects, courses..."
            className="h-12 max-w-xl"
          />
        </div>

        <div className="hidden" role="group" aria-label="Filter resources by category">
          {tabs.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setCategory(t.slug)}
              aria-pressed={activeCategory === t.slug}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeCategory === t.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="mt-8">
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
