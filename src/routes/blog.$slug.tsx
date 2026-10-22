import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ProductCard } from "@/components/ProductCard";
import { coverImageUrl, postBySlugQuery, relatedProductsQuery, readingTimeMinutes } from "@/lib/blog";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    try {
      const post = await context.queryClient.ensureQueryData(postBySlugQuery(params.slug));
      if (!post) throw new Error("Article not found");
      const cover = post.cover_image ? coverImageUrl(post.cover_image) : "";
      return { post, cover };
    } catch { return { post: null, cover: "" }; }
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    const title = post ? (post.meta_title || post.title) : "Article not found | EduWallet";
    const description = post ? (post.meta_description || post.excerpt) : "Browse exam preparation articles and study guides from EduWallet.";
    const cover = loaderData?.cover ?? "";
    const image = cover ? new URL(cover, import.meta.env["VITE_SITE_URL"] || "https://eduwallet.in").toString() : "";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    ];
    if (image) { meta.push({ property: "og:image", content: image }); meta.push({ name: "twitter:image", content: image }); }
    if (!post) meta.push({ name: "robots", content: "noindex, nofollow" });
    return { meta, links: [{ rel: "canonical", href: `/blog/${encodeURIComponent(params.slug)}` }] };
  },
  component: BlogArticle,
});

function fmtDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : "";
}

function BlogArticle() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const query = useQuery({ ...postBySlugQuery(slug), initialData: loaderData.post });
  const related = useQuery(relatedProductsQuery(query.data ?? undefined));
  const post = query.data;
  const cover = post ? coverImageUrl(post.cover_image) : "";
  const base = typeof window === "undefined" ? "https://eduwallet.in" : window.location.origin;
  const jsonLd = post ? {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    ...(cover ? { image: [new URL(cover, base).toString()] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    author: { "@type": "Organization", name: siteConfig.fallbackBrand.brandName || "EduWallet" },
    publisher: { "@type": "Organization", name: siteConfig.fallbackBrand.brandName || "EduWallet" },
  } : null;

  if (query.isLoading) return <main className="page-container max-w-4xl py-12"><Skeleton className="h-9 w-3/4" /><Skeleton className="mt-4 h-5 w-1/2" /><Skeleton className="mt-8 aspect-video w-full" /><div className="mt-8 space-y-3"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-4/5" /></div></main>;
  if (query.isError) return <main className="page-container py-12"><EmptyState title="Article unavailable" description="We could not load this article. Please try again." action={<Link to="/blog" className="text-sm font-semibold text-primary hover:underline">Browse all articles</Link>} /></main>;
  if (!post) return <main className="page-container py-12"><EmptyState title="Article not found" description="This article may have been unpublished or moved." action={<Link to="/blog" className="text-sm font-semibold text-primary hover:underline">Browse all articles</Link>} /></main>;

  return (
    <main className="page-container max-w-5xl py-10 sm:py-14">
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>}
      <article className="mx-auto max-w-3xl">
        {cover && <img src={cover} alt={post.title} className="mb-8 aspect-[16/9] w-full rounded-2xl object-cover" />}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {post.category && <Badge variant="secondary">{post.category}</Badge>}
          <span>{readingTimeMinutes(post.content)} min read</span>
          {post.published_at && <><span aria-hidden="true">·</span><time dateTime={post.published_at}>{fmtDate(post.published_at)}</time></>}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-5 text-lg leading-8 text-muted-foreground">{post.excerpt}</p>}
        <div className="prose-blog mt-8 max-w-none break-words text-base leading-7 text-foreground">
          <ReactMarkdown
            components={{
              h2: ({children}) => <h2 className="mb-3 mt-10 text-2xl font-semibold tracking-tight">{children}</h2>,
              h3: ({children}) => <h3 className="mb-2 mt-8 text-xl font-semibold">{children}</h3>,
              p: ({children}) => <p className="mb-5 leading-7">{children}</p>,
              ul: ({children}) => <ul className="mb-5 list-disc space-y-2 pl-6">{children}</ul>,
              ol: ({children}) => <ol className="mb-5 list-decimal space-y-2 pl-6">{children}</ol>,
              li: ({children}) => <li className="pl-1">{children}</li>,
              blockquote: ({children}) => <blockquote className="mb-5 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">{children}</blockquote>,
              a: ({href, children}) => <a href={href} className="text-primary underline underline-offset-4" rel={href?.startsWith("http") ? "noopener noreferrer" : undefined} target={href?.startsWith("http") ? "_blank" : undefined}>{children}</a>,
              code: ({children}) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>,
              pre: ({children}) => <pre className="mb-5 overflow-x-auto rounded-lg bg-muted p-4 text-sm">{children}</pre>,
            }}
          >{post.content}</ReactMarkdown>
        </div>
        {post.tags.length > 0 && <div className="mt-8 flex flex-wrap gap-2" aria-label="Article tags">{post.tags.map((tag) => <Badge variant="outline" key={tag}>{tag}</Badge>)}</div>}
        <div className="mt-8 border-t border-border pt-5"><Link to="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Back to blog</Link></div>
      </article>
      <section className="mt-12 border-t border-border pt-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Continue learning</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Study material for this topic</h2></div>
          <Link to="/shop" className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">Shop all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {related.isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-72 w-full rounded-xl" />)}</div> :
          (related.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Study materials are being added. Browse the shop for more resources.</p> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{related.data!.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      </section>
    </main>
  );
}
