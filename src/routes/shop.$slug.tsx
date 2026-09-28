import { useSiteSettings } from "@/lib/settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Eye, FileText, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/CoverImage";
import { EmptyState } from "@/components/EmptyState";
import { categoriesQuery, productBySlugQuery, signedUrl } from "@/lib/catalog";
import { discountPercent, formatPrice } from "@/lib/format";
import { siteConfig } from "@/config/site";

function trimDesc(text: string, max = 155) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ context, params }) => {
    try {
      const product = await context.queryClient.ensureQueryData(productBySlugQuery(params.slug));
      const ogImage = product?.cover_image
        ? await signedUrl("product-covers", product.cover_image, 60 * 60 * 24 * 365)
        : null;
      return { product, ogImage };
    } catch {
      return { product: null, ogImage: null };
    }
  },
  head: ({ params, loaderData }) => {
    const p = loaderData?.product;
    const title = p ? `${p.title} — Edu Wallet` : "Study resource — Edu Wallet";
    const desc = p
      ? trimDesc(
          p.description ||
            p.whats_included ||
            `${p.title}: digital exam study resource from Edu Wallet.`,
        )
      : "Digital exam study resource from Edu Wallet. See what's included, format and pricing before you buy.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: loaderData?.ogImage ? "summary_large_image" : "summary" },
    ];
    if (loaderData?.ogImage) {
      meta.push({ property: "og:image", content: loaderData.ogImage });
      meta.push({ name: "twitter:image", content: loaderData.ogImage });
    }
    if (!p) meta.push({ name: "robots", content: "noindex" });
    return { meta, links: [{ rel: "canonical", href: `/shop/${params.slug}` }] };
  },
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
    <div className="min-h-screen bg-background">
      <div className="page-container py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link to="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <span className="mx-1.5">/</span>
          <span>{category?.name ?? "Resource"}</span>
        </nav>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)] lg:gap-12">
          <div className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <CoverImage path={p.cover_image} title={p.title} className="aspect-[3/4]" />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Digital PDF resource</p>
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

            <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{p.title}</h1>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Course", p.course_label ?? "—"],
                ["Subject", p.subject_label ?? "—"],
                ["Format", p.format],
                ["Pages", p.page_count ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-surface px-3 py-3">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            {p.description && (
              <section className="mt-8">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-serif text-xl font-semibold">Description</h2>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="shrink-0 text-primary">
                        See more <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="font-serif text-2xl">{p.title}</DialogTitle>
                      </DialogHeader>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{p.description}</div>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">{p.description}</p>
              </section>
            )}

            {p.whats_included && (
              <section className="mt-6">
                <h2 className="font-serif text-xl font-semibold">What's included</h2>
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

            <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-md">
              <div className="p-5 sm:p-6">
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

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
                  <Button size="lg" className="w-full rounded-xl px-7 font-semibold shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg sm:w-auto" asChild>
                    <Link to="/checkout/$slug" params={{ slug: p.slug }}>
                      <ShoppingBag className="mr-2 h-4 w-4" /> Buy Now
                    </Link>
                  </Button>
                )}
                {preview.data && !p.is_free && (
                  <Button size="lg" variant="outline" className="w-full rounded-xl sm:w-auto" asChild>
                    <a href={preview.data} target="_blank" rel="noreferrer">
                      <Eye className="mr-2 h-4 w-4" /> Preview Sample
                    </a>
                  </Button>
                )}
              </div>
              </div>
            </div>

            <div className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                This is a digital product. No physical item will be shipped.
              </p>
              <p>
                Payment is made via UPI and verified manually. {s.deliveryEstimate ? `${s.deliveryEstimate}, the` : "Once verified, the"}
                material is sent to your registered email address or WhatsApp number.
              </p>
              <p><strong className="text-foreground">Refund / access policy:</strong> Because this is a digital product, access is provided after payment verification. If you have a payment or delivery issue, contact support before taking further action.</p>
              <p><strong className="text-foreground">Need help?</strong> Use the Contact page and include your order details so our team can assist quickly.</p>
              {isAssignment && <p>{siteConfig.assignmentDisclaimer}</p>}
              <p>{siteConfig.disclaimer}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
