import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { coverImageUrl, postCategoriesQuery, postUrl, publishedPostsQuery, readingTimeMinutes } from "@/lib/blog";
import { absoluteUrl, BRAND, buildMeta, buildTitle } from "@/lib/seo";

const BLOG_TITLE = buildTitle(["Blog", "Exam Tips, Strategies & Study Guides", BRAND]);
const BLOG_DESCRIPTION = buildMeta("Exam preparation tips, strategies and study guides for NEET, JEE, UPSC, SSC and Banking from the EduWallet team.");

export const Route = createFileRoute("/blog/")({
  loader: async ({ context }) => {
    const [posts, categories] = await Promise.all([
      context.queryClient.ensureQueryData(publishedPostsQuery()),
      context.queryClient.ensureQueryData(postCategoriesQuery()),
    ]);
    return { posts, categories };
  },
  head: () => ({
    meta: [
      { title: BLOG_TITLE },
      { name: "description", content: BLOG_DESCRIPTION },
      { property: "og:title", content: BLOG_TITLE },
      { property: "og:description", content: BLOG_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/blog") },
      { property: "og:image", content: absoluteUrl("/og-image.svg") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: BLOG_TITLE },
      { name: "twitter:description", content: BLOG_DESCRIPTION },
      { name: "twitter:image", content: absoluteUrl("/og-image.svg") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/blog") }],
  }),
  component: Page,
});

function Page() {
  const { posts: initialPosts, categories: initialCategories } = Route.useLoaderData();
  const [rawSearch, setRawSearch] = useState("");
  const [category, setCategory] = useState("");

  const filteredPosts = (initialPosts ?? []).filter((post) => {
    const term = rawSearch.trim().toLowerCase();
    return (!term || [post.title, post.excerpt].some((value) => value?.toLowerCase().includes(term))) &&
      (!category || post.category === category);
  });

  return (
    <main className="page-container py-12">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="font-serif text-4xl font-bold">Exam Preparation Blog</h1>
        <p className="mt-3 text-muted-foreground">
          Exam preparation tips, strategies and study guides for NEET, JEE, UPSC, SSC and Banking.
        </p>
      </header>
      <div className="mx-auto mt-8 max-w-xl">
        <Input value={rawSearch} onChange={(event) => setRawSearch(event.target.value)} placeholder="Search articles…" />
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button size="sm" variant={!category ? "default" : "outline"} onClick={() => setCategory("")}>All</Button>
        {initialCategories?.map((item) => (
          <Button key={item.name} size="sm" variant={category === item.name ? "default" : "outline"} onClick={() => setCategory(item.name)}>
            {item.name} ({item.count})
          </Button>
        ))}
      </div>
      {!filteredPosts.length ? (
        <div className="py-12"><EmptyState title="No articles found" description="Try another search or category." /></div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-xl border bg-card">
              {post.cover_image ? (
                <img src={coverImageUrl(post.cover_image)} alt={post.title ? `Cover image for ${post.title}` : ""} className="aspect-video w-full object-cover" loading="lazy" decoding="async" width={800} height={450} />
              ) : (
                <div className="grid aspect-video place-items-center bg-muted" aria-hidden="true">EduWallet</div>
              )}
              <div className="p-5">
                <p className="text-xs uppercase text-primary">{post.category}</p>
                <h2 className="mt-2 text-lg font-semibold">
                  <a href={postUrl(post.slug)}>{post.title}</a>
                </h2>
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
