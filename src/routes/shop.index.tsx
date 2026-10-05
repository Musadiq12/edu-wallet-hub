import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, LoadingGrid } from "@/components/EmptyState";
import { matchesSearch, productsQuery } from "@/lib/catalog";

type ShopSearch = { q?: string; course?: string };

const courses = ["CSEET", "CS Executive", "CS Professional"] as const;

export const Route = createFileRoute("/shop/")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    course: typeof search.course === "string" && courses.includes(search.course as typeof courses[number]) ? search.course : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Revivor CS Test Series — CSEET, CS Executive & CS Professional" },
      { name: "description", content: "Chapter-wise and full-syllabus CS test series for CSEET, CS Executive and CS Professional." },
      { property: "og:title", content: "Revivor CS Test Series — CSEET, CS Executive & CS Professional" },
      { property: "og:description", content: "Chapter-wise and full-syllabus CS test series for CSEET, CS Executive and CS Professional." },
    ],
    links: [{ rel: "canonical", href: "/shop" }],
  }),
  component: Shop,
});

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(search.q ?? "");
  const products = useQuery(productsQuery({ limit: 100 }));
  const activeCourse = search.course ?? "all";

  const filtered = (products.data ?? []).filter((product) => {
    if (activeCourse !== "all" && product.course_label !== activeCourse) return false;
    return matchesSearch(product, term);
  });

  const setCourse = (course: string) => {
    void navigate({
      to: "/shop",
      search: { q: term || undefined, course: course === "all" ? undefined : course },
    });
  };

  const tabs = [
    { slug: "all", name: "All Test Series" },
    ...courses.map((course) => ({ slug: course, name: course })),
  ];

  return (
    <div className="section-y">
      <div className="page-container">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Revivor CS Test Series</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Choose Your Test Series</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Chapter-wise and full-syllabus preparation for CSEET, CS Executive and CS Professional, with expert checking and mentorship.
        </p>

        <div className="mt-6">
          <label htmlFor="shop-search" className="sr-only">Search test series</label>
          <Input
            id="shop-search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search CSEET, CS Executive, modules..."
            className="h-12 max-w-xl"
          />
        </div>

        <div className="mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              onClick={() => setCourse(tab.slug)}
              aria-pressed={activeCourse === tab.slug}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                activeCourse === tab.slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {products.isLoading ? (
            <LoadingGrid count={8} />
          ) : products.isError ? (
            <EmptyState title="We couldn't load the test series" description="Please refresh the page and try again." />
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : term ? (
            <EmptyState title="No test series found" description="Try another course, module, or search term." />
          ) : (
            <EmptyState title="Test series are being added" description="Please check back shortly." />
          )}
        </div>
      </div>
    </div>
  );
}
