import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  whats_included: string | null;
  category_id: string | null;
  course_label: string | null;
  subject_label: string | null;
  keywords: string | null;
  price: number | string;
  discounted_price: number | string | null;
  cover_image: string | null;
  pdf_file: string | null;
  preview_file: string | null;
  page_count: number | null;
  format: string;
  is_free: boolean;
  is_featured: boolean;
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
};

const PRODUCT_FIELDS =
  "id,title,slug,description,whats_included,category_id,course_label,subject_label,keywords,price,discounted_price,cover_image,pdf_file,preview_file,page_count,format,is_free,is_featured,is_active,is_demo,created_at";

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug,description,sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

export const productsQuery = (opts?: {
  featured?: boolean;
  free?: boolean;
  categorySlug?: string;
  limit?: number;
}) =>
  queryOptions({
    queryKey: ["products", opts ?? {}],
    queryFn: async (): Promise<Product[]> => {
      let q = supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (opts?.featured) q = q.eq("is_featured", true);
      if (opts?.free !== undefined) q = q.eq("is_free", opts.free);
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

export const productBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("slug", slug)
        .eq("is_active", true)
        .eq("is_archived", false)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as Product | null;
    },
  });

export const adminProductsQuery = () =>
  queryOptions({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

/** Private buckets: resolve a temporary readable URL for a stored file. */
export async function signedUrl(
  bucket: string,
  path: string | null,
  seconds = 3600,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function matchesSearch(p: Product, term: string, categoryName?: string) {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return [p.title, p.subject_label, p.course_label, p.keywords, p.description, categoryName]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(t));
}
