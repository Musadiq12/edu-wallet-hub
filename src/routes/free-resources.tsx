import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, LoadingGrid } from "@/components/EmptyState";
import { productsQuery } from "@/lib/catalog";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/free-resources")({
  head: () => ({
    meta: [
      { title: `Free IGNOU Study Resources — ${siteConfig.fallbackBrand.brandName}` },
      {
        name: "description",
        content:
          "Free IGNOU samples and study material from Edu Wallet. Preview the format before buying paid resources.",
      },
      { property: "og:title", content: `Free IGNOU Study Resources — ${siteConfig.fallbackBrand.brandName}` },
      {
        property: "og:description",
        content: "Free IGNOU samples and study material from Edu Wallet.",
      },
    ],
    links: [{ rel: "canonical", href: "/free-resources" }],
  }),
  component: FreeResources,
});

function FreeResources() {
  const free = useQuery(productsQuery({ free: true }));

  return (
    <div className="section-y">
      <div className="page-container">
        <h1 className="text-3xl font-bold sm:text-4xl">Free Resources</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Free samples and study material so you can see the format and quality of Edu Wallet
          resources before purchasing anything.
        </p>

        <div className="mt-8">
          {free.isLoading ? (
            <LoadingGrid />
          ) : free.data && free.data.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {free.data.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <EmptyState title="Free resources are coming soon" />
          )}
        </div>
      </div>
    </div>
  );
}
