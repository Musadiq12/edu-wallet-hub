import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL } from "@/lib/seo";

const BASE = SITE_URL;
const STATIC = ["/", "/shop", "/free-resources", "/about", "/contact", "/terms", "/privacy", "/blog"];

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function urlEntry(path: string, lastmod?: string | null) {
  const modified = lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : "";
  return `<url><loc>${xmlEscape(`${BASE}${path}`)}</loc>${modified}</url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabaseUrl = process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"];
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !supabaseKey) return new Response("Sitemap unavailable", { status: 500 });

        const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
        const [{ data: products, error: productError }, { data: posts, error: blogError }] = await Promise.all([
          sb.from("products").select("slug,updated_at").eq("is_active", true).eq("is_archived", false).eq("is_demo", false).or("seller_id.is.null,and(status.eq.published,revision_of.is.null,deleted_at.is.null)").range(0, 4999),
          sb.from("blog_posts").select("slug,updated_at").eq("status", "published").range(0, 4999),
        ]);
        if (productError || blogError) return new Response("Sitemap unavailable", { status: 500 });

        const urls = [
          ...STATIC.map((path) => urlEntry(path)),
          ...(products ?? []).map((product) => urlEntry(`/shop/${encodeURIComponent(product.slug)}`, product.updated_at ? new Date(product.updated_at).toISOString().slice(0, 10) : null)),
          ...(posts ?? []).map((post) => urlEntry(`/blog/${encodeURIComponent(post.slug)}`, post.updated_at ? new Date(post.updated_at).toISOString().slice(0, 10) : null)),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
