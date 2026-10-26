import { MarkdownContent } from "@/components/MarkdownContent";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/EmptyState";
import { siteConfig } from "@/config/site";
import { coverImageUrl, postBySlugQuery, readingTimeMinutes, relatedProductsQuery } from "@/lib/blog";
import { SITE_URL, breadcrumbJson, jsonLd } from "@/lib/seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(postBySlugQuery(params.slug)),
  head: ({ params, loaderData }) => {
    const p = loaderData as { title?: string; meta_title?: string; excerpt?: string; meta_description?: string; cover_image?: string; published_at?: string | null; updated_at?: string } | null | undefined;
    const title = p?.meta_title || p?.title || "Exam Preparation Blog | EduWallet";
    const description = p?.meta_description || p?.excerpt || siteConfig.shortDescription;
    const canonical = new URL(`/blog/${encodeURIComponent(params.slug)}`, SITE_URL).toString();
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "article" }, { property: "og:url", content: canonical },
        { name: "twitter:card", content: p?.cover_image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title }, { name: "twitter:description", content: description },
        ...(p?.cover_image ? [
          { property: "og:image", content: coverImageUrl(p.cover_image) },
          { name: "twitter:image", content: coverImageUrl(p.cover_image) },
        ] : []),
        ...(!p ? [{ name: "robots", content: "noindex, follow" }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const q = useQuery(postBySlugQuery(slug));
  const p = q.data;
  const rel = useQuery(relatedProductsQuery(p ?? undefined));

  if (q.isLoading) return <main className="page-container py-12"><div className="h-80 animate-pulse rounded bg-muted" /></main>;
  if (!p) return <main className="page-container py-12 text-center"><EmptyState title="Article not found" description="This article may have been unpublished or moved." /><Link to="/blog" className="text-primary underline">Browse all articles</Link></main>;

  const image = p.cover_image ? coverImageUrl(p.cover_image) : "";
  const canonical = new URL(`/blog/${encodeURIComponent(p.slug)}`, SITE_URL).toString();
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonical}#article`,
    headline: p.title,
    description: p.excerpt,
    mainEntityOfPage: canonical,
    ...(image ? { image: [image] } : {}),
    ...(p.published_at ? { datePublished: p.published_at } : {}),
    dateModified: p.updated_at,
    author: { "@type": "Organization", name: siteConfig.fallbackBrand.brandName },
    publisher: { "@type": "Organization", name: siteConfig.fallbackBrand.brandName, logo: { "@type": "ImageObject", url: new URL("/edu-wallet-icon.svg", SITE_URL).toString() } },
  };
  const crumbs = breadcrumbJson([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: p.title, path: `/blog/${p.slug}` },
  ]);

  return (
    <main className="page-container max-w-5xl py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link><span> / </span><Link to="/blog" className="hover:text-foreground">Blog</Link><span> / </span><span aria-current="page">{p.title}</span>
        </nav>
        {image && <img src={image} alt={`Cover image for ${p.title}`} width={1200} height={675} loading="eager" fetchPriority="high" className="mb-8 max-h-[480px] w-full rounded-xl object-cover" />}
        <p className="text-sm text-muted-foreground">{p.category} · {readingTimeMinutes(p.content)} min read</p>
        <h1 className="mt-4 font-serif text-3xl font-bold sm:text-5xl">{p.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{p.excerpt}</p>
        <div className="prose-blog mt-8"><MarkdownContent content={p.content} /></div>
        <div className="mt-8 flex flex-wrap gap-2">{p.tags.map((t) => <span key={t} className="rounded-full border px-3 py-1 text-xs">{t}</span>)}</div>
        <Link to="/blog" className="mt-8 inline-block text-primary">← Back to blog</Link>
      </article>
      <section className="mt-14">
        <h2 className="mb-5 text-2xl font-bold">Study material for this topic</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{rel.data?.map((x) => <ProductCard key={x.id} product={x} compact />)}</div>
        <p className="mt-5"><Link to="/free-resources" className="text-primary underline">Explore free study resources</Link></p>
      </section>
    </main>
  );
}
