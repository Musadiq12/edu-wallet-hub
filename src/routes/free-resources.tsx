import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, LoadingGrid } from "@/components/EmptyState";
import { productsQuery } from "@/lib/catalog";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/free-resources")({
  head: () => ({
    meta: [
      { title: "Free Study Resources" },
      {
        name: "description",
        content:
          "Free samples and study material across exam categories from Edu Wallet. Preview the format before buying paid resources.",
      },
      { property: "og:title", content: "Free Study Resources" },
      {
        property: "og:description",
        content: "Free samples and study material across exam categories from Edu Wallet.",
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
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Explore free samples and study material to understand the format, level of detail, and usefulness of EduWallet resources before purchasing. Resources may include revision notes, practice questions, sample papers, and exam-preparation guides where available.
        </p>
        <section className="mt-6 max-w-3xl space-y-2 text-sm leading-6 text-muted-foreground" aria-labelledby="free-resources-guide">
          <h2 id="free-resources-guide" className="text-base font-semibold text-foreground">How to use these free study materials</h2>
          <p>Choose a resource that matches your exam and current topic. Use it alongside the latest official syllabus and instructions, and check the product details before relying on any material for a specific exam attempt.</p>
          <p>Free resources are provided as study aids. Availability can change as new materials are added, and some subjects or exams may not have a free sample yet.</p>
        </section>

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
