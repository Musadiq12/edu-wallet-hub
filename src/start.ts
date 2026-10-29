import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Redirect only non-canonical hostnames. HTTPS enforcement is handled by Cloudflare
// at the edge: the Worker request URL may reflect an internal scheme and must not be
// used to infer the visitor's original HTTP/HTTPS scheme. Leave non-GET methods untouched.
const canonicalHostMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (request.method !== "GET" && request.method !== "HEAD") return next();

  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const needsRedirect =
    host === "edu-wallet-hub.designeroutletmedia.workers.dev" ||
    host === "www.eduwallethub.in";

  if (!needsRedirect) return next();

  url.protocol = "https:";
  url.hostname = "eduwallethub.in";
  url.port = "";
  return new Response(null, {
    status: 301,
    headers: { Location: url.toString(), "Cache-Control": "public, max-age=3600" },
  });
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [canonicalHostMiddleware, errorMiddleware, csrfMiddleware],
}));
