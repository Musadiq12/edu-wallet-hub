import { withSupabase } from "npm:@supabase/server";

const allowedOrigin = () => Deno.env.get("SITE_URL")?.replace(/\/$/, "") ?? "";
function headers(origin: string | null) {
  const allowed = allowedOrigin();
  const corsOrigin = origin && (origin === allowed || /^http:\/\/localhost:\d+$/.test(origin)) ? origin : allowed;
  return {
    "Access-Control-Allow-Origin": corsOrigin || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}
function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers(req.headers.get("Origin")) });
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req.headers.get("Origin")) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return json(req, { error: "Razorpay is not configured on the server." }, 503);

  const { data: auth, error: authError } = await ctx.supabase.auth.getUser();
  if (authError || !auth.user) return json(req, { error: "Please sign in to verify your payment." }, 401);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 8_192) return json(req, { error: "Request is too large." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json(req, { error: "Invalid request body." }, 400);
  }
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const razorpayOrderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id.trim() : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id.trim() : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature.trim().toLowerCase() : "";
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^order_[A-Za-z0-9]+$/.test(razorpayOrderId) ||
      !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^[a-f0-9]{64}$/.test(signature)) {
    return json(req, { error: "Payment verification details are invalid." }, 400);
  }

  const { data: order, error: orderError } = await ctx.supabaseAdmin.from("orders")
    .select("id,user_id,amount,payment_status,order_status,payment_gateway,razorpay_order_id,razorpay_payment_id,razorpay_status")
    .eq("id", orderId).eq("user_id", auth.user.id).maybeSingle();
  if (orderError) {
    console.error("Razorpay verification order lookup failed:", orderError);
    return json(req, { error: "Could not load your order." }, 500);
  }
  if (!order || order.payment_gateway !== "razorpay" || order.razorpay_order_id !== razorpayOrderId) {
    return json(req, { error: "Payment does not match an order for this account." }, 404);
  }

  if (order.razorpay_status === "paid" || order.razorpay_status === "fulfilled") {
    if (order.razorpay_payment_id === paymentId) return json(req, { ok: true, orderId, status: order.razorpay_status, alreadyVerified: true });
    return json(req, { error: "This order has already been paid using a different payment." }, 409);
  }
  if (order.razorpay_status !== "created") return json(req, { error: "This payment session is no longer active. Contact support if money was deducted." }, 409);

  const expected = await hmacHex(keySecret, `${razorpayOrderId}|${paymentId}`);
  if (!safeEqual(expected, signature)) return json(req, { error: "Payment signature verification failed." }, 400);

  let paymentResponse: Response;
  try {
    paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Razorpay payment lookup failed:", error);
    return json(req, { error: "Could not confirm payment status yet. Please retry verification." }, 502);
  }
  const payment = await paymentResponse.json().catch(() => null);
  if (!paymentResponse.ok || payment?.id !== paymentId || payment?.order_id !== razorpayOrderId ||
      payment?.currency !== "INR" || payment?.amount !== Math.round(Number(order.amount) * 100) ||
      payment?.status !== "captured") {
    console.warn("Razorpay payment did not pass server-side checks:", {
      orderId, responseStatus: paymentResponse.status, paymentStatus: payment?.status,
    });
    return json(req, { error: "Payment is not yet confirmed as captured. Wait briefly and retry; do not pay again." }, 409);
  }

  const verifiedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await ctx.supabaseAdmin.from("orders")
    .update({
      razorpay_payment_id: paymentId,
      razorpay_signature_verified_at: verifiedAt,
      razorpay_status: "paid",
      transaction_id: paymentId,
      payment_status: "verified",
      order_status: "payment_verified",
      status: "Payment Verified",
      verified_at: verifiedAt,
    })
    .eq("id", orderId)
    .eq("user_id", auth.user.id)
    .eq("razorpay_order_id", razorpayOrderId)
    .eq("razorpay_status", "created")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Razorpay verified payment could not be saved:", updateError);
    return json(req, { error: "Payment was confirmed, but order status could not be updated. Do not pay again; contact support." }, 500);
  }
  if (!updated) {
    const { data: latest } = await ctx.supabaseAdmin.from("orders")
      .select("razorpay_payment_id,razorpay_status").eq("id", orderId).maybeSingle();
    if (latest?.razorpay_payment_id === paymentId && ["paid", "fulfilled"].includes(latest.razorpay_status)) {
      return json(req, { ok: true, orderId, status: latest.razorpay_status, alreadyVerified: true });
    }
    return json(req, { error: "Payment was confirmed, but the order changed concurrently. Contact support and do not pay again." }, 409);
  }

  return json(req, { ok: true, orderId, status: "paid", message: "Payment verified. Order fulfilment will be handled securely." });
}));
