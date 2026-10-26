import { useState } from "react";
import { useSiteSettings } from "@/lib/settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth";
import { canReviewQuery, myReviewQuery, productReviewsQuery, reviewSummaryQuery, submitReview, updateMyReview } from "@/lib/reviews";
import { friendlyError } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { publicImageUrl } from "@/lib/image-storage";
import { ArrowRight, Eye, FileText, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/CoverImage";
import { EmptyState } from "@/components/EmptyState";
import { categoriesQuery, productBySlugQuery, signedUrl } from "@/lib/catalog";
import { discountPercent, effectivePrice, formatPrice, hasDiscount } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { absoluteUrl, BRAND, buildMeta, buildTitle } from "@/lib/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ context, params }) => {
    const [productResult, categoriesResult] = await Promise.allSettled([
      context.queryClient.ensureQueryData(productBySlugQuery(params.slug)),
      context.queryClient.ensureQueryData(categoriesQuery()),
    ]);
    const product = productResult.status === "fulfilled" ? productResult.value : null;
    const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
    const ogImage = product?.cover_image
      ? await signedUrl("product-covers", product.cover_image, 60 * 60 * 24 * 365)
      : null;
    return { product, categories, ogImage };
  },
  head: ({ params, loaderData }) => {
    const p = loaderData?.product;
    const title = p?.seo_title?.trim() || (p ? buildTitle([p.title, p.format, BRAND]) : buildTitle(["Study resource", BRAND]));
    const desc = p
      ? trimDesc(
          p.description ||
            p.whats_included ||
            `${p.title}: ${p.product_type === "physical" ? "physical study book or printed notes" : "digital exam study resource"} from EduWallet.`,
        )
      : "Digital exam study resource from EduWallet. See what's included, format and pricing before you buy.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { property: "og:url", content: absoluteUrl(`/shop/${params.slug}`) },
      { name: "twitter:card", content: loaderData?.ogImage ? "summary_large_image" : "summary" },
    ];
    if (loaderData?.ogImage) {
      meta.push({ property: "og:image", content: loaderData.ogImage });
      meta.push({ name: "twitter:image", content: loaderData.ogImage });
    }
    if (!p) meta.push({ name: "robots", content: "noindex" });
    return { meta, links: [{ rel: "canonical", href: absoluteUrl(`/shop/${params.slug}`) }] };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const s = useSiteSettings();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { product: p, categories: initialCategories } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const product = useQuery({ ...productBySlugQuery(slug), initialData: p });
  const categories = useQuery({ ...categoriesQuery(), initialData: initialCategories });
  const reviews = useQuery(productReviewsQuery(product.data?.id ?? ""));
  const reviewSummary = useQuery(reviewSummaryQuery(product.data?.id ?? ""));
  const myReview = useQuery(myReviewQuery(product.data?.id ?? "", user?.id));
  const canReview = useQuery(canReviewQuery(product.data?.id ?? "", user?.id));
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [editingReview, setEditingReview] = useState(false);

  const preview = useQuery({
    queryKey: ["preview", p?.preview_file],
    enabled: !!p?.preview_file,
    queryFn: () => signedUrl("product-previews", p!.preview_file),
  });

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
  const discountedPrice = hasDiscount(price, discounted);
  const category = categories.data?.find((c) => c.id === p.category_id);
  const isAssignment = category?.slug === "assignment-guidance";

  const ratingData = reviewSummary.data ?? { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
  const schemaDescription = buildMeta((p.description || p.whats_included || "").replace(/<[^>]*>/g, ""), 300);
  const coverUrl = p.cover_image ? publicImageUrl("product-covers", p.cover_image) ?? undefined : undefined;
  const productSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    url: absoluteUrl(`/shop/${p.slug}`),
    description: schemaDescription,
    ...(coverUrl ? { image: coverUrl } : {}),
    offers: { "@type": "Offer", price: String(effectivePrice(p)), priceCurrency: "INR", availability: "https://schema.org/InStock" },
    ...(ratingData.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: String(ratingData.average), reviewCount: String(ratingData.count) } } : {}),
  };
  const handleSubmitReview = async () => {
    if (!user) return;
    setReviewSaving(true);
    try {
      const payload = { productId: p.id, userId: user.id, queryClient, rating: reviewRating, title: reviewTitle, comment: reviewComment };
      if (editingReview && myReview.data?.status === "pending") {
        await updateMyReview(myReview.data.id, payload);
        toast.success("Review updated.");
      } else {
        await submitReview(payload);
        toast.success("Thanks! Your review will appear after approval.");
      }
      setEditingReview(false); setReviewTitle(""); setReviewComment(""); setReviewRating(0);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reviews", p.id] }),
        queryClient.invalidateQueries({ queryKey: ["review-summary", p.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-review", p.id, user.id] }),
        queryClient.invalidateQueries({ queryKey: ["can-review", p.id, user.id] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : friendlyError(error, "Could not submit the review."));
    } finally { setReviewSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, "\\u003c") }} />
      <div className="page-container py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link to="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <span className="mx-1.5">/</span>
          <span aria-current="page">{p.title}</span>
        </nav>

        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)] lg:gap-12">
          <div className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <CoverImage path={p.cover_image} title={p.title} />
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">{p.product_type === "physical" ? "Physical book / printed notes" : "Digital PDF resource"}</p>
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
                  <span className="text-3xl font-semibold">{formatPrice(effectivePrice(p))}</span>
                  {discountedPrice && (
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
                  p.pdf_file && /^https:\/\/(drive\.google\.com|docs\.google\.com)\//i.test(p.pdf_file) ? (
                    <Button size="lg" asChild>
                      <a href={p.pdf_file} target="_blank" rel="noopener noreferrer">
                        Open Free Resource
                      </a>
                    </Button>
                  ) : (
                    <Button size="lg" disabled>
                      Google Drive link not added
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


            <section className="mt-10 w-full min-w-0 max-w-full border-t border-border pt-8" aria-labelledby="reviews-heading">
              <h2 id="reviews-heading" className="font-serif text-2xl font-semibold">Reviews</h2>
              {ratingData.count === 0 ? <p className="mt-3 text-sm text-muted-foreground">No reviews yet</p> : (
                <div className="mt-4 grid min-w-0 max-w-full gap-5 rounded-xl border border-border p-5 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <div>
                    <p className="text-4xl font-semibold tabular-nums">{ratingData.average.toFixed(1)}</p>
                    <div className="mt-1 flex text-amber-500" aria-label={`${ratingData.average} out of 5 stars`}>
                      {Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4" fill={i + 1 <= ratingData.average ? "currentColor" : "none"} />)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Based on {ratingData.count} reviews</p>
                  </div>
                  <div className="min-w-0 space-y-2">
                    {ratingData.distribution.map((count, i) => {
                      const star = 5 - i;
                      return <div key={star} className="flex items-center gap-3 text-xs">
                        <span className="w-6 shrink-0">{star}★</span>
                        <div className="h-2 flex-1 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-amber-500" style={{ width: `${ratingData.count ? count / ratingData.count * 100 : 0}%` }} /></div>
                        <span className="w-5 text-right tabular-nums">{count}</span>
                      </div>;
                    })}
                  </div>
                </div>
              )}
              <div className="mt-5 w-full min-w-0 max-w-full space-y-3">
                {reviews.isError ? <p className="text-sm text-muted-foreground">Reviews could not be loaded. Refresh the page to try again.</p> :
                  (reviews.data ?? []).length === 0 ? <EmptyState title="No reviews yet" className="border-0 bg-transparent py-8" /> :
                  (reviews.data ?? []).map((review) => <article key={review.id} className="block w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex text-amber-500" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4" fill={i < review.rating ? "currentColor" : "none"} />)}</div>
                        </div>
                        {review.title && <h3 className="mt-2 break-words font-semibold [overflow-wrap:anywhere]">{review.title}</h3>}
                      </div>
                      <time className="max-w-full shrink-0 text-xs text-muted-foreground" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time>
                    </div>
                    <p className="mt-2 block w-full min-w-0 max-w-full whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{review.comment}</p>
                    <p className="mt-3 text-xs font-medium text-foreground">{review.display_name || "Student"}</p>
                  </article>)}
              </div>
              {user && myReview.data && !editingReview ? <div className="mt-6 rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Your review</p></div>
                <div className="mt-2 flex text-amber-500">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4" fill={i < myReview.data!.rating ? "currentColor" : "none"} />)}</div>
                {myReview.data.title && <p className="mt-2 font-medium">{myReview.data.title}</p>}
                <p className="mt-1 block w-full min-w-0 max-w-full whitespace-pre-wrap break-all text-sm text-muted-foreground [overflow-wrap:anywhere]">{myReview.data.comment}</p>
                {myReview.data.status === "pending" && <Button className="mt-3" variant="outline" size="sm" onClick={() => { setReviewRating(myReview.data!.rating); setReviewTitle(myReview.data!.title); setReviewComment(myReview.data!.comment); setEditingReview(true); }}>Edit review</Button>}
              </div> : user && (editingReview || (!myReview.data && canReview.data === true)) ? <div className="mt-6 rounded-xl border border-border p-5">
                <h3 className="font-semibold">{editingReview ? "Edit your review" : "Write a review"}</h3>
                <div className="mt-4"><span className="text-sm font-medium">Rating (required)</span><div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
                  {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => <button type="button" key={star} role="radio" aria-checked={reviewRating === star} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => setReviewRating(star)} className="rounded p-1 text-amber-500 focus-visible:outline focus-visible:outline-2"><Star className="h-6 w-6" fill={star <= reviewRating ? "currentColor" : "none"} /></button>)}
                </div></div>
                <label className="mt-4 block text-sm font-medium">Title (optional)<input maxLength={100} value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" placeholder="Summarize your experience" /></label>
                <label className="mt-4 block text-sm font-medium">Comment (required)<Textarea rows={4} maxLength={1000} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="mt-1" placeholder="What did you think of this resource?" /><span className="mt-1 block text-xs font-normal text-muted-foreground">{reviewComment.length}/1000</span></label>
                <Button className="mt-4" disabled={reviewSaving || !reviewRating || !reviewComment.trim()} onClick={() => void handleSubmitReview()}>{reviewSaving ? "Submitting…" : editingReview ? "Save changes" : "Submit review"}</Button>
                <p className="mt-3 text-xs text-muted-foreground">Thank you for sharing your feedback.</p>
              </div> : user && canReview.data === false ? <p className="mt-6 text-sm text-muted-foreground">Reviews open after your purchase is verified.</p> : null}
            </section>
            <div className="mt-6 space-y-3 rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                {p.product_type === "physical" ? "This is a physical product. A delivery address is required and courier details will be provided when dispatched." : "This is a digital product. No physical item will be shipped."}
              </p>
              <p>
                Payment is made via UPI and verified manually. {p.product_type === "physical" ? "After verification, your order will be prepared for dispatch and tracking details can be sent via WhatsApp." : `${s.deliveryEstimate ? `${s.deliveryEstimate}, the` : "Once verified, the"} material is sent to your registered email address or WhatsApp number.`}
              </p>
              <p><strong className="text-foreground">Refund / access policy:</strong> {p.product_type === "physical" ? "For physical products, contact support about delivery issues, damaged items, or cancellation before dispatch." : "Because this is a digital product, access is provided after payment verification. If you have a payment or delivery issue, contact support before taking further action."}</p>
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
