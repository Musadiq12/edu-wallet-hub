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
  validity_days: number | null;
  features: string[];
  test_type: string;
};

const mapSeries = (row: any): Product => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  description: row.description ?? null,
  whats_included: Array.isArray(row.features) ? row.features.join("\n") : null,
  category_id: null,
  course_label: row.course ?? null,
  subject_label: row.subject ?? null,
  keywords: [row.course, row.subject, row.test_type].filter(Boolean).join(" "),
  price: Number(row.price ?? 0),
  discounted_price: row.discount_price == null ? null : Number(row.discount_price),
  cover_image: row.thumbnail_url ?? null,
  pdf_file: null,
  preview_file: null,
  page_count: null,
  format: "Online Test Series",
  is_free: false,
  is_featured: Number(row.sort_order ?? 0) < 4,
  is_active: row.status === "published",
  is_demo: false,
  created_at: row.created_at,
  validity_days: row.validity_days ?? null,
  features: Array.isArray(row.features) ? row.features : [],
  test_type: row.test_type ?? "",
});

export const productsQuery = (opts?: { featured?: boolean; free?: boolean; categorySlug?: string; limit?: number }) =>
  queryOptions({
    queryKey: ["revivor-series-catalog", opts ?? {}],
    queryFn: async (): Promise<Product[]> => {
      let q = supabase.from("test_series")
        .select("id,title,slug,description,course,subject,test_type,price,discount_price,validity_days,features,thumbnail_url,status,sort_order,created_at")
        .eq("status", "published")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (opts?.featured) q = q.limit(opts.limit ?? 6);
      else q = q.limit(opts?.limit ?? 100);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []).map(mapSeries);
      if (opts?.featured) rows = rows.slice(0, opts.limit ?? 6);
      return rows;
    },
  });

export const productBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["revivor-series", slug],
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase.from("test_series")
        .select("id,title,slug,description,course,subject,test_type,price,discount_price,validity_days,features,thumbnail_url,status,sort_order,created_at")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data ? mapSeries(data) : null;
    },
  });

export const categoriesQuery = () => queryOptions({
  queryKey: ["revivor-courses"],
  queryFn: async () => {
    const { data, error } = await supabase.from("test_series")
      .select("course")
      .eq("status", "published");
    if (error) throw error;
    return [...new Set((data ?? []).map((x: any) => x.course).filter(Boolean))].map((name) => ({
      id: name,
      name,
      slug: String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: null,
      sort_order: 0,
    }));
  },
});

export const adminProductsQuery = productsQuery;

export function matchesSearch(p: Product, term: string, categoryName?: string) {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return [p.title, p.subject_label, p.course_label, p.keywords, p.description, categoryName]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(t));
}

export function effectivePrice(p: Product) {
  return Number(p.discounted_price ?? p.price ?? 0);
}

export async function fileUrl(): Promise<string | null> {
  return null;
}

export const signedUrl = fileUrl;
