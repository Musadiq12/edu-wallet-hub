import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { coverImageUrl, postCategoriesQuery, postUrl, publishedPostsQuery, readingTimeMinutes } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Exam Preparation Blog | Study Tips and Guides" },
      { name: "description", content: "Read practical exam preparation guides, revision strategies and study tips to help students plan learning and make better use of resources." },
      { property: "og:title", content: "Exam Preparation Blog | Study Tips and Guides" },
      { property: "og:description", content: "Read practical exam preparation guides, revision strategies and study tips to help students plan learning and make better use of resources." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: new URL("/blog", SITE_URL).toString() },
      { property: "og:image", content: new URL("/og-image.svg", SITE_URL).toString() },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Exam Preparation Blog | Study Tips and Guides" },
      { name: "twitter:description", content: "Read practical exam preparation guides, revision strategies and study tips to help students plan learning and make better use of resources." },
      { name: "twitter:image", content: new URL("/og-image.svg", SITE_URL).toString() },
    ],
    links: [{ rel: "canonical", href: new URL("/blog", SITE_URL).toString() }],
  }),
  component: Page,
});

function Page() {
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(rawSearch), 300);
    return () => window.clearTimeout(timer);
  }, [rawSearch]);
  const categories = useQuery(postCategoriesQuery());
  const posts = useQuery(publishedPostsQuery({ search, category }));

  return (
    <main className="page-container py-12">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-serif text-4xl font-bold">Exam Preparation Blog</h1>
        <p className="mt-3 text-muted-foreground">Practical study strategies, exam guidance, and resources to help you prepare.</p>
      </header>
      <div className="mx-auto mt-8 max-w-xl">
        <label htmlFor="blog-search" className="sr-only">Search articles</label>
        <Input id="blog-search" value={rawSearch} onChange={(event) => setRawSearch(event.target.value)} placeholder="Search articles…" />
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button size="sm" variant={!category ? "default" : "outline"} onClick={() => setCategory("")}>All</Button>
        {categories.data?.map((item) => <Button key={item.name} size="sm" variant={category === item.name ? "default" : "outline"} onClick={() => setCategory(item.name)}>{item.name} ({item.count})</Button>)}
      </div>
      {posts.isLoading ? <div className="mt-10 h-64 animate-pulse rounded bg-muted" /> : !posts.data?.length ? (
        <div className="py-12"><EmptyState title="No articles found" description="Try another search or category." /></div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.data.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-xl border bg-card">
              {post.cover_image ? <img src={coverImageUrl(post.cover_image)} alt={`Cover image for ${post.title}`} width={1200} height={675} loading="lazy" decoding="async" className="aspect-video w-full object-cover" /> : <div className="grid aspect-video place-items-center bg-muted">EduWallet</div>}
              <div className="p-5">
                <p className="text-xs uppercase text-primary">{post.category}</p>
                <h2 className="mt-2 text-lg font-semibold"><Link to={postUrl(post.slug) as "/blog/$slug"} params={{ slug: post.slug }}>{post.title}</Link></h2>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                <p className="mt-4 text-xs text-muted-foreground">{readingTimeMinutes(post.excerpt)} min read</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
