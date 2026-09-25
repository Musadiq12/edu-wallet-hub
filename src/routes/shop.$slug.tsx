import { useSiteSettings } from "@/lib/settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/CoverImage";
import { EmptyState } from "@/components/EmptyState";
import { categoriesQuery, productBySlugQuery, signedUrl } from "@/lib/catalog";
import { discountPercent, formatPrice } from "@/lib/format";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/shop/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")}` },
      {
        name: "description",
        content:
          "Digital IGNOU study resource from Edu Wallet. See what's included, format and pricing before you buy.",
      },
      { property: "og:title", content: "Study resource" },
      {
        property: "og:description",
        content: "Digital IGNOU study resource from Edu Wallet.",
      },
    ],
    links: [{ rel: "canonical", href: `/shop/${params.slug}` }],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const s = useSiteSettings();
  const { slug } = Route.useParams();
  const product = useQuery(productBySlugQuery(slug));
  const categories = useQuery(categoriesQuery());

  const p = product.data;
  const preview = useQuery({
    queryKey: ["preview", p?.preview_file],
    enabled: !!p?.preview_file,
    queryFn: () => signedUrl("product-previews", p!.preview_file),
  });

  if (product.isLoading) {
    return (
      <div className="page-container section-y">
        <div className="h-96 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="page-container section-y">
        <EmptyState
          title="Resource unavailable"
          description="This resource is no longer available or the link is incorrect."
          action={
            <Button asChild>
              <Link to="/shop">Back to shop</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const price = Number(p.price ?? 0);
  const discounted = p.discounted_price != null ? Number(p.discounted_price) : null;
  const off = discountPercent(price, discounted);
  const category = categories.data?.find((c) => c.id === p.category_id);
  const isAssignment = category?.slug === "assignment-guidance";

  return (
    <div className="section-y">
      <div className="page-container">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <span className="mx-1.5">/</span>
          <span>{category?.name ?? "Resource"}</span>
        </nav>

        <div className="mt-5 grid gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <CoverImage path={p.cover_image} title={p.title} className="aspect-[3/4]" />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-1.5">
              {p.is_demo && (
                <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                  Demo / placeholder
                </Badge>
              )}
              {category && <Badge variant="secondary">{category.name}</Badge>}
              {p.is_free && <Badge className="bg-success text-success-foreground">Free</Badge>}
            </div>

            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{p.title}</h1>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:max-w-md">
              <div>
                <dt className="text-muted-foreground">Course / Programme</dt>
                <dd className="font-medium">{p.course_label ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Subject</dt>
                <dd className="font-medium">{p.subject_label ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Format</dt>
                <dd className="font-medium">{p.format}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pages</dt>
                <dd className="font-medium">{p.page_count ?? "—"}</dd>
              </div>
            </dl>

            {p.description && (
              <section className="mt-6">
                <h2 className="text-lg font-semibold">Description</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </section>
            )}

            {p.whats_included && (
              <section className="mt-6">
                <h2 className="text-lg font-semibold">What's included</h2>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {p.whats_included.split(/[,\n]/).map((item, i) =>
                    item.trim() ? (
                      <li key={i} className="flex gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        {item.trim()}
                      </li>
                    ) : null,
                  )}
                </ul>
              </section>
            )}

            <div className="mt-8 rounded-lg border border-border bg-card p-5">
              {p.is_free ? (
                <p className="text-2xl font-semibold text-success">Free</p>
              ) : (
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-semibold">{formatPrice(discounted ?? price)}</span>
                  {off && (
                    <>
                      <span className="text-lg text-muted-foreground line-through">
                        {formatPrice(price)}
                      </span>
                      <Badge className="bg-accent text-accent-foreground">{off}% OFF</Badge>
                    </>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                {p.is_free ? (
                  preview.data ? (
                    <Button size="lg" asChild>
                      <a href={preview.data} target="_blank" rel="noreferrer">
                        Download Resource
                      </a>
                    </Button>
                  ) : (
                    <Button size="lg" disabled>
                      File coming soon
                    </Button>
                  )
                ) : (
                  <Button size="lg" className="sm:flex-1" asChild>
                    <Link to="/checkout/$slug" params={{ slug: p.slug }}>
                      Buy Now
                    </Link>
                  </Button>
                )}
                {preview.data && !p.is_free && (
                  <Button size="lg" variant="outline" className="sm:flex-1" asChild>
                    <a href={preview.data} target="_blank" rel="noreferrer">
                      Preview Sample
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-3 rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                This is a digital product. No physical item will be shipped.
              </p>
              <p>
                Payment is made via UPI and verified manually. {s.deliveryEstimate ? `${s.deliveryEstimate}, the` : "Once verified, the"}
                material is sent to your registered email address or WhatsApp number.
              </p>
              {isAssignment && <p>{siteConfig.assignmentDisclaimer}</p>}
              <p>{siteConfig.disclaimer}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
