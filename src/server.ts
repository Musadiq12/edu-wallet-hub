import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const PUBLIC_HTML_PATHS = new Set(["/", "/shop", "/blog", "/about", "/contact", "/free-resources", "/terms", "/privacy", "/cookies"]);
const HTML_CACHE_TTL_SECONDS = 60;

function isPublicHtmlRequest(request: Request, url: URL): boolean {
  return request.method === "GET" &&
    request.headers.get("accept")?.includes("text/html") === true &&
    !request.headers.has("cookie") &&
    !request.headers.has("authorization") &&
    url.search === "" &&
    PUBLIC_HTML_PATHS.has(url.pathname.replace(/\/$/, "") || "/");
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const cacheKey = isPublicHtmlRequest(request, url)
      ? new Request(new URL(url.pathname.replace(/\/$/, "") || "/", url.origin).toString(), { method: "GET" })
      : undefined;
    try {
      if (cacheKey) {
        const cached = await caches.default.match(cacheKey);
        if (cached) {
          const headers = new Headers(cached.headers);
          headers.set("X-HTML-Cache", "HIT");
          return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
        }
      }
      const handler = await getServerEntry();
      const response = await normalizeCatastrophicSsrResponse(await handler.fetch(request, env, ctx));
      const contentType = response.headers.get("content-type") || "";
      if (cacheKey && response.status === 200 && contentType.includes("text/html") && !response.headers.has("set-cookie")) {
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", `public, max-age=0, s-maxage=${HTML_CACHE_TTL_SECONDS}, stale-while-revalidate=300`);
        headers.set("X-HTML-Cache", "MISS");
        const cacheableResponse = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        const executionContext = ctx as { waitUntil?: (promise: Promise<unknown>) => void };
        if (typeof executionContext?.waitUntil === "function") {
          executionContext.waitUntil(caches.default.put(cacheKey, cacheableResponse.clone()));
        } else {
          await caches.default.put(cacheKey, cacheableResponse.clone());
        }
        return cacheableResponse;
      }
      return response;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
