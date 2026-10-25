const encoder = new TextEncoder();

export function razorpayCredentials() {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured on the server.");
  }
  return { keyId, keySecret };
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}

export async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { keyId, keySecret } = razorpayCredentials();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Basic ${btoa(`${keyId}:${keySecret}`)}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Razorpay API request failed", {
      path,
      status: response.status,
      code: data?.error?.code,
    });
    throw new Error("Razorpay could not process the payment request.");
  }
  return data as T;
}

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export function validText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}
