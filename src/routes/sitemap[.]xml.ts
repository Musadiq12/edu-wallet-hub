import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://edu-wallet-hub.lovable.app";
const STATIC = ["/", "/shop", "/free-resources", "/about", "/contact"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const sb = createClient(
          process.env['SUPABASE_URL'] ?? import.meta.env['VITE_SUPABASE_URL'],
          process.env['SUPABASE_PUBLISHABLE_KEY'] ?? import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'],
          { auth: { persistSession: false } },
        );
        const { data, error } = await sb
          .from("products")
          .select("slug,updated_at")
          .eq("is_active", true)
          .eq("is_archived", false)
          .eq("is_demo", false)
          .range(0, 4999);
        if (error) return new Response("Sitemap unavailable", { status: 500 });
        const urls = [
          ...STATIC.map((p) => `<url><loc>${BASE}${p}</loc></url>`),
          ...(data ?? []).map(
            (r) =>
              `<url><loc>${BASE}/shop/${encodeURIComponent(r.slug)}</loc>${r.updated_at ? `<lastmod>${new Date(r.updated_at).toISOString()}</lastmod>` : ""}</url>`,
          ),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
