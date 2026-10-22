import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/admin";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  cover_image: string;
  meta_title: string;
  meta_description: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
export type BlogPostListItem = Omit<BlogPost, "content">;
export type BlogCategory = { name: string; count: number };

const POST_FIELDS = "id,slug,title,excerpt,category,tags,cover_image,meta_title,meta_description,status,published_at,created_at,updated_at";
const ALL_POST_FIELDS = `${POST_FIELDS},content`;

export const postUrl = (slug: string) => `/blog/${encodeURIComponent(slug)}`;
export const readingTimeMinutes = (content: string) =>
  Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));

export function coverImageUrl(path: string): string {
  if (!path) return "";
  const { data } = supabase.storage.from("blog-covers").getPublicUrl(path);
  return data?.publicUrl ?? "";
}

export const publishedPostsQuery = (opts: { search?: string; category?: string } = {}) =>
  queryOptions({
    queryKey: ["blog", "published", opts],
    queryFn: async (): Promise<BlogPostListItem[]> => {
      let q = supabase.from("blog_posts").select(POST_FIELDS).eq("status", "published")
        .order("published_at", { ascending: false }).limit(100);
      const search = (opts.search ?? "").trim().replace(/[%_,]/g, "");
      if (search) q = q.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      if (opts.category) q = q.eq("category", opts.category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BlogPostListItem[];
    },
  });

export const postCategoriesQuery = () =>
  queryOptions({
    queryKey: ["blog", "categories"],
    queryFn: async (): Promise<BlogCategory[]> => {
      const { data, error } = await supabase.from("blog_posts").select("category").eq("status", "published");
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const category = row.category?.trim();
        if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
      }
      return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

export const latestPostsQuery = () =>
  queryOptions({
    queryKey: ["blog", "latest"],
    queryFn: async (): Promise<BlogPostListItem[]> => {
      const { data, error } = await supabase.from("blog_posts").select(POST_FIELDS)
        .eq("status", "published").order("published_at", { ascending: false }).limit(3);
      if (error) throw error;
      return (data ?? []) as unknown as BlogPostListItem[];
    },
  });

export const postBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["blog", "post", slug],
    queryFn: async (): Promise<BlogPost | null> => {
      const { data, error } = await supabase.from("blog_posts").select(ALL_POST_FIELDS)
        .eq("slug", slug).eq("status", "published").maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as BlogPost | null;
    },
  });

export const relatedProductsQuery = (post: BlogPost | undefined) =>
  queryOptions({
    queryKey: ["blog", "related-products", post?.id ?? null, post?.category ?? "", post?.tags ?? []],
    enabled: !!post,
    queryFn: async (): Promise<Product[]> => {
      if (!post) return [];
      const terms = [post.category, ...post.tags].map((term) => term.trim().replace(/[%,_]/g, "")).filter(Boolean);
      let matches: Product[] = [];
      if (terms.length) {
        const clauses = terms.flatMap((term) => [
          `course_label.ilike.%${term}%`,
          `keywords.ilike.%${term}%`,
        ]);
        const { data, error } = await supabase.from("products")
          .select("id,product_type,title,slug,description,whats_included,category_id,course_label,subject_label,keywords,price,discounted_price,cover_image,pdf_file,preview_file,page_count,format,is_free,is_featured,is_active,is_demo,created_at")
          .eq("is_active", true).eq("is_archived", false).eq("is_demo", false)
          .or(clauses.join(",")).order("created_at", { ascending: false }).limit(4);
        if (error) throw error;
        matches = (data ?? []) as unknown as Product[];
      }
      if (matches.length) return matches;
      const { data, error } = await supabase.from("products")
        .select("id,product_type,title,slug,description,whats_included,category_id,course_label,subject_label,keywords,price,discounted_price,cover_image,pdf_file,preview_file,page_count,format,is_free,is_featured,is_active,is_demo,created_at")
        .eq("is_active", true).eq("is_archived", false).eq("is_demo", false).eq("is_featured", true)
        .order("created_at", { ascending: false }).limit(4);
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

export const adminPostsQuery = (statusTab: "all" | "draft" | "published" = "all") =>
  queryOptions({
    queryKey: ["admin", "blog-posts", statusTab],
    queryFn: async (): Promise<BlogPostListItem[]> => {
      let q = supabase.from("blog_posts").select(POST_FIELDS).order("created_at", { ascending: false });
      if (statusTab !== "all") q = q.eq("status", statusTab);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BlogPostListItem[];
    },
  });

export const adminPostQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "blog-post", id],
    queryFn: async (): Promise<BlogPost | null> => {
      const { data, error } = await supabase.from("blog_posts").select(ALL_POST_FIELDS).eq("id", id).maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as BlogPost | null;
    },
  });

export async function uniqueSlugCheck(slug: string, excludeId?: string): Promise<boolean> {
  let q = supabase.from("blog_posts").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (excludeId) q = q.neq("id", excludeId);
  const { count, error } = await q;
  if (error) throw error;
  return (count ?? 0) === 0;
}

export type BlogPostInput = Omit<BlogPost, "id" | "created_at" | "updated_at" | "published_at"> & {
  id?: string;
  published_at?: string | null;
};

export async function savePost(input: BlogPostInput): Promise<string> {
  if (input.status !== "draft" && input.status !== "published") throw new Error("Invalid article status.");
  const { id, ...fields } = input;
  const now = new Date().toISOString();
  if (id) {
    const current = await supabase.from("blog_posts").select("published_at").eq("id", id).maybeSingle();
    if (current.error) throw current.error;
    const publishedAt = fields.status === "published" ? (current.data?.published_at ?? now) : fields.published_at ?? current.data?.published_at ?? null;
    const { data, error } = await supabase.from("blog_posts").update({ ...fields, published_at: publishedAt, updated_at: now }).eq("id", id).select("id").single();
    if (error) throw new Error(friendlyError(error, "Could not save the article."));
    return data.id;
  }
  const { data, error } = await supabase.from("blog_posts").insert({
    ...fields,
    status: fields.status === "published" ? "published" : "draft",
    published_at: fields.status === "published" ? fields.published_at ?? now : null,
  }).select("id").single();
  if (error) throw new Error(friendlyError(error, "Could not save the article."));
  return data.id;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}
