import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { publicImageUrl } from "@/lib/image-storage";
import type { Product } from "@/lib/catalog";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  cover_image: string;
  og_image: string | null;
  author_name: string | null;
  scheduled_at: string | null;
  meta_title: string;
  seo_title: string | null;
  seo_description: string | null;
  meta_description: string;
  status: "draft" | "scheduled" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
export type BlogPostListItem = Omit<BlogPost, "content">;
export const postUrl = (slug: string) => `/blog/${encodeURIComponent(slug)}`;
export const readingTimeMinutes = (content: string) => Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));
export const coverImageUrl = (path: string | null | undefined) => publicImageUrl("blog-covers", path) ?? "";
const F = "id,slug,title,excerpt,category,tags,cover_image,og_image,author_name,scheduled_at,meta_title,seo_title,seo_description,meta_description,status,published_at,created_at,updated_at";

export const publishedPostsQuery = (options: { search?: string; category?: string } = {}) => queryOptions({
  queryKey: ["blog", "published", options],
  queryFn: async () => {
    const pageSize = 1000;
    const all: BlogPostListItem[] = [];
    for (let from = 0; ; from += pageSize) {
      let query = supabase.from("blog_posts").select(F).eq("status", "published")
        .order("published_at", { ascending: false }).range(from, from + pageSize - 1);
      const search = (options.search ?? "").trim().replace(/[%_,]/g, "");
      if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%`);
      if (options.category) query = query.eq("category", options.category);
      const { data, error } = await query;
      if (error) throw error;
      const page = (data ?? []) as unknown as BlogPostListItem[];
      all.push(...page);
      if (page.length < pageSize) break;
    }
    return all;
  },
});

export const postCategoriesQuery = () => queryOptions({
  queryKey: ["blog", "categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("blog_posts").select("category").eq("status", "published");
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const row of data ?? []) if (row.category) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count }));
  },
});

export const postBySlugQuery = (slug: string) => queryOptions({
  queryKey: ["blog", "post", slug],
  queryFn: async () => {
    const { data, error } = await supabase.from("blog_posts").select("*")
      .eq("slug", slug).eq("status", "published").maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as BlogPost | null;
  },
});

const PRODUCT_FIELDS = "id,title,slug,description,price,discounted_price,cover_image,product_images,is_free,is_featured,category_id,course_label,subject_label,keywords,format,page_count,created_at";
export const relatedProductsQuery = (post: BlogPost | undefined) => queryOptions({
  queryKey: ["blog", "related", post?.id],
  enabled: !!post,
  queryFn: async () => {
    if (!post) return [] as Product[];
    const terms = [post.category, ...(post.tags ?? [])].filter(Boolean);
    for (const term of terms) {
      const pattern = term.replace(/[%_,]/g, "");
      const { data, error } = await supabase.from("products").select(PRODUCT_FIELDS)
        .eq("is_active", true).eq("is_archived", false).eq("is_demo", false)
        .or(`and(seller_id.is.null),and(status.eq.published,revision_of.is.null,deleted_at.is.null),and(course_label.ilike.%${pattern}%,keywords.ilike.%${pattern}%)`)
        .limit(4);
      if (error) throw error;
      if (data?.length) return data as unknown as Product[];
    }
    const { data, error } = await supabase.from("products").select(PRODUCT_FIELDS)
      .eq("is_active", true).eq("is_archived", false).eq("is_demo", false).eq("is_featured", true)
      .or("seller_id.is.null,and(status.eq.published,revision_of.is.null,deleted_at.is.null)").limit(4);
    if (error) throw error;
    return (data ?? []) as unknown as Product[];
  },
});

export type BlogFilter = "all" | "draft" | "scheduled" | "published";
export const adminPostsQuery = (filter: BlogFilter) => queryOptions({
  queryKey: ["admin", "blog", filter],
  queryFn: async () => {
    let query = supabase.from("blog_posts").select(F).order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as BlogPostListItem[];
  },
});

export const adminPostQuery = (id: string) => queryOptions({
  queryKey: ["admin", "blog", "post", id],
  queryFn: async () => {
    const { data, error } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as BlogPost | null;
  },
});

export async function uniqueSlugCheck(slug: string, id?: string) {
  let query = supabase.from("blog_posts").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (id) query = query.neq("id", id);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) === 0;
}

export async function savePost(values: Partial<BlogPost> & Pick<BlogPost, "slug" | "title" | "excerpt" | "content">) {
  const status: BlogPost["status"] = values.status === "published" || values.status === "scheduled" ? values.status : "draft";
  const payload = {
    ...values,
    status,
    updated_at: new Date().toISOString(),
    published_at: status === "published" ? (values.published_at ?? new Date().toISOString()) : null,
    scheduled_at: status === "scheduled" ? (values.scheduled_at ?? null) : null,
  };
  const result = values.id
    ? await supabase.from("blog_posts").update(payload).eq("id", values.id).select("*").single()
    : await supabase.from("blog_posts").insert(payload).select("*").single();
  if (result.error) throw result.error;
  return result.data as unknown as BlogPost;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}
