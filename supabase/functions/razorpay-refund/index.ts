import { withSupabase } from "npm:@supabase/server";

const encoder = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function razorpayRequest(path: string, method: string, body?: unknown) {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Razorpay credentials are not configured.");
  return await fetch("https://api.razorpay.com/v1" + path, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": Deno.env.get("SITE_URL") ?? "null",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin",
      },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const { data: auth, error: authError } = await ctx.supabase.auth.getUser();
  if (authError || !auth.user) return json({ error: "Authentication required." }, 401);
  const { data: isAdmin, error: roleError } = await ctx.supabase.rpc("has_role", {
    _user_id: auth.user.id, _role: "admin",
  });
  if (roleError || isAdmin !== true) return json({ error: "Administrator access required." }, 403);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 8192) return json({ error: "Request too large." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const orderId = body.orderId;
  const requestedAmount = body.amountPaise;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const requestKey = typeof body.requestKey === "string" ? body.requestKey.trim() : "";
  if (!validId(orderId) || !Number.isSafeInteger(requestedAmount) || Number(requestedAmount) <= 0 ||
      Number(requestedAmount) > 100_000_000 || !/^[A-Za-z0-9_-]{12,100}$/.test(requestKey)) {
    return json({ error: "Provide a valid order, refund amount in paise, and unique request key." }, 400);
  }

  const { data: order, error: orderError } = await ctx.supabaseAdmin.from("orders")
    .select("id,amount,payment_gateway,payment_status,order_status,razorpay_payment_id,razorpay_status")
    .eq("id", orderId).maybeSingle();
  if (orderError) {
    console.error("Refund order lookup failed:", orderError);
    return json({ error: "Could not load the order." }, 500);
  }
  if (!order || order.payment_gateway !== "razorpay" || !order.razorpay_payment_id ||
      !["paid", "fulfilled", "partially_refunded"].includes(order.razorpay_status) ||
      order.payment_status !== "verified") {
    return json({ error: "Only verified Razorpay payments can be refunded." }, 409);
  }

  const amountPaise = Number(requestedAmount);
  const paidPaise = Math.round((Number(order.amount) + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(paidPaise) || amountPaise > paidPaise) {
    return json({ error: "Refund amount cannot exceed the original payment." }, 400);
  }

  // Fetch current refund totals from Razorpay so repeated requests cannot exceed the
  // remaining refundable amount, including refunds initiated outside this dashboard.
  let paymentResponse: Response;
  try {
    paymentResponse = await razorpayRequest(`/payments/${encodeURIComponent(order.razorpay_payment_id)}`, "GET");
  } catch (error) {
    console.error("Razorpay payment lookup failed:", error);
    return json({ error: "Could not check the payment with Razorpay. Retry later." }, 502);
  }
  const payment = await paymentResponse.json().catch(() => null);
  if (!paymentResponse.ok || payment?.id !== order.razorpay_payment_id ||
      payment?.currency !== "INR" || payment?.status !== "captured" ||
      payment?.amount !== paidPaise) {
    return json({ error: "Razorpay did not confirm a captured, matching payment." }, 409);
  }

  const { data: prior, error: priorError } = await ctx.supabaseAdmin.from("razorpay_refunds")
    .select("id,razorpay_refund_id,amount_paise,status")
    .eq("order_id", order.id).eq("reason", `request:${requestKey}`).maybeSingle();
  if (priorError) {
    console.error("Refund idempotency lookup failed:", priorError);
    return json({ error: "Could not check prior refund requests." }, 500);
  }
  if (prior) return json({ ok: true, refund: prior, duplicate: true });

  const { data: refunds, error: refundsError } = await ctx.supabaseAdmin.from("razorpay_refunds")
    .select("amount_paise,status").eq("order_id", order.id).in("status", ["requested", "processed"]);
  if (refundsError) return json({ error: "Could not calculate the remaining refundable amount." }, 500);
  const recordedTotal = (refunds ?? []).reduce((sum, refund) => sum + Number(refund.amount_paise), 0);
  const gatewayRefundTotal = Array.isArray(payment?.amount_refunded) ? 0 : Number(payment?.amount_refunded ?? 0);
  const remaining = paidPaise - Math.max(recordedTotal, gatewayRefundTotal);
  if (amountPaise > remaining) return json({ error: "Refund amount exceeds the remaining refundable balance." }, 409);

  const { data: refundRecord, error: insertError } = await ctx.supabaseAdmin.from("razorpay_refunds")
    .insert({
      order_id: order.id,
      razorpay_payment_id: order.razorpay_payment_id,
      amount_paise: amountPaise,
      currency: "INR",
      status: "requested",
      reason: `request:${requestKey}${reason ? ` | ${reason}` : ""}`.slice(0, 500),
      requested_by: auth.user.id,
    })
    .select("id,amount_paise,status")
    .single();
  if (insertError || !refundRecord) {
    console.error("Refund record insert failed:", insertError);
    return json({ error: "Could not record the refund request." }, 500);
  }

  let gatewayResponse: Response;
  try {
    gatewayResponse = await razorpayRequest(
      `/payments/${encodeURIComponent(order.razorpay_payment_id)}/refund`,
      "POST",
      { amount: amountPaise, notes: { internal_order_id: order.id, refund_request_id: refundRecord.id } },
    );
  } catch (error) {
    console.error("Razorpay refund request failed:", error);
    await ctx.supabaseAdmin.from("razorpay_refunds").update({ status: "failed" }).eq("id", refundRecord.id);
    return json({ error: "Razorpay could not confirm the refund request. Check the payment dashboard before retrying." }, 502);
  }

  const gatewayRefund = await gatewayResponse.json().catch(() => null);
  if (!gatewayResponse.ok || typeof gatewayRefund?.id !== "string" ||
      gatewayRefund.payment_id !== order.razorpay_payment_id ||
      gatewayRefund.amount !== amountPaise) {
    console.error("Razorpay rejected refund:", gatewayResponse.status, gatewayRefund?.error?.code);
    await ctx.supabaseAdmin.from("razorpay_refunds").update({ status: "failed" }).eq("id", refundRecord.id);
    return json({ error: "Razorpay rejected the refund request." }, 502);
  }

  const status = gatewayRefund.status === "processed" ? "processed" : "requested";
  const { error: saveError } = await ctx.supabaseAdmin.from("razorpay_refunds")
    .update({ razorpay_refund_id: gatewayRefund.id, status, updated_at: new Date().toISOString() })
    .eq("id", refundRecord.id);
  if (saveError) {
    console.error("Could not save Razorpay refund ID:", saveError);
    return json({ error: "Refund was accepted by Razorpay, but its local record needs reconciliation." }, 500);
  }

  const totalRefunded = recordedTotal + amountPaise;
  const orderRefundStatus = totalRefunded >= paidPaise ? "refunded" : "partially_refunded";
  const { error: orderUpdateError } = await ctx.supabaseAdmin.from("orders")
    .update({ razorpay_status: orderRefundStatus })
    .eq("id", order.id).eq("payment_gateway", "razorpay");
  if (orderUpdateError) {
    console.error("Could not update order refund status:", orderUpdateError);
    return json({ error: "Refund was accepted, but the order status needs reconciliation." }, 500);
  }

  return json({
    ok: true,
    refund: { id: refundRecord.id, razorpayRefundId: gatewayRefund.id, amountPaise, status },
    orderRefundStatus,
  }, 201);
}));
