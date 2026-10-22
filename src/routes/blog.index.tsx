import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { coverImageUrl, postCategoriesQuery, publishedPostsQuery, postUrl, readingTimeMinutes, type BlogPostListItem } from "@/lib/blog";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Exam Tips, Strategies & Study Guides | EduWallet" },
      { name: "description", content: siteConfig.shortDescription },
      { property: "og:title", content: "Blog — Exam Tips, Strategies & Study Guides | EduWallet" },
      { property: "og:description", content: siteConfig.shortDescription },
    ],
  }),
  component: BlogIndex,
});

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "";
}

function ArticleCard({ post }: { post: BlogPostListItem }) {
  const cover = coverImageUrl(post.cover_image);
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      <Link to={postUrl(post.slug)} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {cover ? <img src={cover} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" /> : <div className="flex aspect-[16/9] items-center justify-center bg-muted text-sm text-muted-foreground">EduWallet Blog</div>}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {post.category && <Badge variant="secondary">{post.category}</Badge>}
            <span className="text-xs text-muted-foreground">{readingTimeMinutes((post as BlogPostListItem & { content?: string }).content ?? post.excerpt)} min read</span>
          </div>
          <h2 className="mt-3 line-clamp-2 text-lg font-semibold tracking-tight">{post.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
          <div className="mt-4 text-xs text-muted-foreground">{formatDate(post.published_at)}</div>
        </div>
      </Link>
    </article>
  );
}

function BlogIndex() {
  const [rawSearch, setRawSearch] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  // ponytail: small local debounce keeps dependencies unchanged; a query only runs after typing pauses.
  useMemo(() => {
    const timer = setTimeout(() => setSearch(rawSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);
  const query = useQuery(publishedPostsQuery({ search, category }));
  const categories = useQuery(postCategoriesQuery());

  return (
    <main className="page-container py-10 sm:py-14">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">EduWallet Articles</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Exam Preparation Blog</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">Practical exam strategies, study guides, revision tips and resources to make preparation more focused.</p>
      </header>
      <div className="mt-8 flex flex-col gap-4">
        <label className="relative block max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={rawSearch} onChange={(e) => setRawSearch(e.target.value)} placeholder="Search articles…" className="h-11 pl-9" aria-label="Search articles" />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Filter by category">
          <button type="button" onClick={() => setCategory("")} className={`rounded-full border px-3 py-1.5 text-sm ${!category ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>All articles</button>
          {(categories.data ?? []).map((item) => (
            <button key={item.name} type="button" onClick={() => setCategory(item.name)} className={`rounded-full border px-3 py-1.5 text-sm ${category === item.name ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
              {item.name} <span className="opacity-70">({item.count})</span>
            </button>
          ))}
        </div>
      </div>
      {query.isLoading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="overflow-hidden rounded-xl border border-border"><Skeleton className="aspect-[16/9] w-full rounded-none" /><div className="space-y-3 p-5"><Skeleton className="h-4 w-20" /><Skeleton className="h-6 w-full" /><Skeleton className="h-4 w-4/5" /></div></div>)}</div>
      ) : query.isError ? (
        <p className="mt-8 text-sm text-destructive">Articles could not be loaded. Please try again.</p>
      ) : (query.data ?? []).length === 0 ? (
        <div className="mt-8"><EmptyState title="No articles found" description="Try another search or category." action={<button type="button" onClick={() => { setRawSearch(""); setSearch(""); setCategory(""); }} className="text-sm font-semibold text-primary hover:underline">Clear filters</button>} /></div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{(query.data ?? []).map((post) => <ArticleCard key={post.id} post={post} />)}</div>
      )}
      <div className="mt-10"><Link to="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Browse study material <ArrowRight className="h-4 w-4" /></Link></div>
    </main>
  );
}
