type Env = {
  PRODUCTS: any;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVER_KEY: string;
  DOWNLOAD_SIGNING_SECRET: string;
  DELIVERY_SECRET: string;
  ALLOWED_ORIGIN?: string;
};

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const DOWNLOAD_TTL_SECONDS = 48 * 60 * 60;

function origin(request: Request, env: Env) {
  return env.ALLOWED_ORIGIN || request.headers.get("Origin") || "*";
}

function json(request: Request, env: Env, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin(request, env),
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Delivery-Secret",
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

function safeKey(value: string) {
  return value
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/[^a-zA-Z0-9._/-]/g, "-")
    .replace(/\/{2,}/g, "/");
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function requireAdmin(request: Request, env: Env) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!userResponse.ok) return null;

  const user = await userResponse.json() as { id?: string };
  if (!user.id) return null;

  const roleResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&select=user_id&limit=1`,
    {
      headers: {
        apikey: env.SUPABASE_SERVER_KEY,
        Accept: "application/json",
      },
    },
  );

  if (!roleResponse.ok) return null;
  const roles = await roleResponse.json() as Array<{ user_id: string }>;
  return roles.length > 0 ? user.id : null;
}

async function verifyDownloadSignature(key: string, exp: number, signature: string, env: Env) {
  if (!Number.isSafeInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await sign(`${key}|${exp}`, env.DOWNLOAD_SIGNING_SECRET);
  return expected === signature;
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin(request, env),
          "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Delivery-Secret",
          "Access-Control-Allow-Methods": "GET, PUT, DELETE, POST, OPTIONS",
          "Vary": "Origin",
        },
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json(request, env, { ok: true, service: "edu-wallet-r2" });
    }

    if (url.pathname === "/upload" && request.method === "PUT") {
      const adminId = await requireAdmin(request, env);
      if (!adminId) return json(request, env, { error: "Administrator access required." }, 403);

      const filename = url.searchParams.get("filename") || "document.pdf";
      const key = safeKey(`products/${crypto.randomUUID()}-${filename}`);
      const contentType = request.headers.get("Content-Type") || "application/pdf";
      const length = Number(request.headers.get("Content-Length") || 0);

      if (contentType !== "application/pdf") {
        return json(request, env, { error: "Only PDF files are allowed." }, 415);
      }
      if (length > MAX_PDF_BYTES) {
        return json(request, env, { error: "The PDF is larger than 50 MB." }, 413);
      }
      if (!request.body) {
        return json(request, env, { error: "The upload body is empty." }, 400);
      }

      await env.PRODUCTS.put(key, request.body, {
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: { uploadedBy: adminId },
      });

      return json(request, env, { ok: true, path: key });
    }

    if (url.pathname === "/delete" && request.method === "DELETE") {
      const adminId = await requireAdmin(request, env);
      if (!adminId) return json(request, env, { error: "Administrator access required." }, 403);

      const key = safeKey(url.searchParams.get("key") || "");
      if (!key.startsWith("products/")) {
        return json(request, env, { error: "Invalid product object key." }, 400);
      }

      await env.PRODUCTS.delete(key);
      return json(request, env, { ok: true });
    }

    if (url.pathname === "/admin-delivery-link" && request.method === "POST") {
      const adminId = await requireAdmin(request, env);
      if (!adminId) return json(request, env, { error: "Administrator access required." }, 403);

      let body: { key?: string; expiresIn?: number };
      try {
        body = await request.json();
      } catch {
        return json(request, env, { error: "Invalid JSON body." }, 400);
      }

      const key = safeKey(body.key || "");
      if (!key.startsWith("products/")) {
        return json(request, env, { error: "Invalid product object key." }, 400);
      }

      const expiresIn = Math.min(
        Math.max(Number(body.expiresIn) || DOWNLOAD_TTL_SECONDS, 60),
        7 * 24 * 60 * 60,
      );
      const exp = Math.floor(Date.now() / 1000) + expiresIn;
      const signature = await sign(`${key}|${exp}`, env.DOWNLOAD_SIGNING_SECRET);
      const downloadUrl = `${new URL(request.url).origin}/download?key=${encodeURIComponent(key)}&exp=${exp}&sig=${signature}`;

      return json(request, env, { ok: true, url: downloadUrl, expiresAt: new Date(exp * 1000).toISOString() });
    }

    if (url.pathname === "/delivery-link" && request.method === "POST") {
      if (request.headers.get("X-Delivery-Secret") !== env.DELIVERY_SECRET) {
        return json(request, env, { error: "Unauthorized." }, 401);
      }

      let body: { key?: string; expiresIn?: number };
      try {
        body = await request.json();
      } catch {
        return json(request, env, { error: "Invalid JSON body." }, 400);
      }

      const key = safeKey(body.key || "");
      if (!key.startsWith("products/")) {
        return json(request, env, { error: "Invalid product object key." }, 400);
      }

      const expiresIn = Math.min(
        Math.max(Number(body.expiresIn) || DOWNLOAD_TTL_SECONDS, 60),
        7 * 24 * 60 * 60,
      );
      const exp = Math.floor(Date.now() / 1000) + expiresIn;
      const signature = await sign(`${key}|${exp}`, env.DOWNLOAD_SIGNING_SECRET);
      const base = env.ALLOWED_ORIGIN?.startsWith("http")
        ? new URL(request.url).origin
        : new URL(request.url).origin;
      const downloadUrl = `${base}/download?key=${encodeURIComponent(key)}&exp=${exp}&sig=${signature}`;

      return json(request, env, { ok: true, url: downloadUrl, expiresAt: new Date(exp * 1000).toISOString() });
    }

    if (url.pathname === "/download" && request.method === "GET") {
      const key = safeKey(url.searchParams.get("key") || "");
      const exp = Number(url.searchParams.get("exp") || 0);
      const signature = url.searchParams.get("sig") || "";

      if (!key.startsWith("products/") || !(await verifyDownloadSignature(key, exp, signature, env))) {
        return new Response("Invalid or expired download link.", { status: 403 });
      }

      const object = await env.PRODUCTS.get(key);
      if (!object) return new Response("File not found.", { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Content-Type", "application/pdf");
      headers.set("Content-Disposition", `attachment; filename="${key.split("/").pop()?.replace(/"/g, "") || "document.pdf"}"`);
      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Robots-Tag", "noindex, nofollow");

      return new Response(object.body, { headers });
    }

    return json(request, env, { error: "Not found." }, 404);
  },
};
