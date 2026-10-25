import { withSupabase } from "npm:@supabase/server";
import { jsonResponse, razorpayRequest } from "../_shared/razorpay.ts";

type RefundResponse = { id: string; status: string; amount: number; payment_id: string };

function parseAmountPaise(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = typeof value === "string" ? value.trim() : String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return null;
  const paise = Math.round(amount * 100);
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const { data: authData, error: authError } = await ctx.supabase.auth.getUser();
  const userId = authData.user?.id;
  if (authError || !userId) return jsonResponse({ error: "Authentication required." }, 401);

  const { data: isAdmin, error: roleError } = await ctx.supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (roleError || isAdmin !== true) return jsonResponse({ error: "Administrator access required." }, 403);

  let body: { orderId?: unknown; amountRupees?: unknown; reason?: unknown };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid request body." }, 400); }

  if (typeof body.orderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.orderId)) {
    return jsonResponse({ error: "A valid order ID is required." }, 400);
  }
  const amountPaise = parseAmountPaise(body.amountRupees);
  if (!amountPaise) return jsonResponse({ error: "Enter a valid refund amount in rupees (up to two decimal places)." }, 400);
  if (body.reason !== undefined && body.reason !== null && (typeof body.reason !== "string" || body.reason.trim().length > 500)) {
    return jsonResponse({ error: "Refund reason must be 1–500 characters." }, 400);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  // Reserve the amount under a database row lock before contacting Razorpay.
  const { data: reservationRows, error: reservationError } = await ctx.supabaseAdmin.rpc("reserve_razorpay_refund", {
    p_order_id: body.orderId, p_amount_paise: amountPaise, p_reason: reason, p_requested_by: userId,
  });
  if (reservationError || !Array.isArray(reservationRows) || !reservationRows[0]?.refund_id) {
    const message = reservationError?.message ?? "Could not reserve this refund.";
    const status = /not found/i.test(message) ? 404 : /exceed|refundable|verified|Razorpay|positive/i.test(message) ? 409 : 500;
    console.error("Refund reservation failed:", { code: reservationError?.code, message });
    return jsonResponse({ error: status === 500 ? "Could not reserve this refund. Check the database migration and try again." : message }, status);
  }

  const reservation = reservationRows[0] as { refund_id: string; payment_id: string; order_amount_paise: number };
  let gatewayRefund: RefundResponse;
  try {
    gatewayRefund = await razorpayRequest<RefundResponse>("/payments/" + encodeURIComponent(reservation.payment_id) + "/refund", {
      method: "POST",
      headers: { "Idempotency-Key": "edu-wallet-refund-" + reservation.refund_id },
      body: JSON.stringify({ amount: amountPaise, notes: { ...(reason ? { reason: reason.slice(0, 500) } : {}), edu_wallet_order_id: body.orderId } }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay refund request failed.";
    // Keep reservation requested when the gateway result is ambiguous; reconcile before retrying.
    const note = (reason ? reason + "\n" : "") + "Gateway result uncertain: " + message;
    await ctx.supabaseAdmin.from("razorpay_refunds").update({ reason: note.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", reservation.refund_id);
    console.error("Razorpay refund result uncertain:", { refundId: reservation.refund_id, message });
    return jsonResponse({ error: "Razorpay's response could not be confirmed. The amount remains reserved to prevent a duplicate refund; reconcile this request before retrying.", refundRequestId: reservation.refund_id }, 502);
  }

  const normalizedStatus = gatewayRefund.status === "processed" ? "processed" : gatewayRefund.status === "failed" ? "failed" : "requested";
  const { error: saveError } = await ctx.supabaseAdmin.from("razorpay_refunds").update({
    razorpay_refund_id: gatewayRefund.id, status: normalizedStatus, updated_at: new Date().toISOString(),
  }).eq("id", reservation.refund_id);
  if (saveError) {
    console.error("Razorpay refund created but local save failed:", { refundId: reservation.refund_id, gatewayRefundId: gatewayRefund.id });
    return jsonResponse({ error: "Razorpay created the refund, but EduWallet could not save its status. Reconcile before requesting another refund.", refundRequestId: reservation.refund_id, razorpayRefundId: gatewayRefund.id }, 500);
  }
  if (normalizedStatus === "failed") {
    return jsonResponse({ ok: false, refundRequestId: reservation.refund_id, razorpayRefundId: gatewayRefund.id, status: normalizedStatus }, 502);
  }

  const { data: refundRows, error: totalsError } = await ctx.supabaseAdmin.from("razorpay_refunds").select("amount_paise,status").eq("order_id", body.orderId);
  if (totalsError) {
    console.error("Refund recorded, but order refund totals could not be recalculated:", totalsError);
    return jsonResponse({ ok: true, refundRequestId: reservation.refund_id, razorpayRefundId: gatewayRefund.id, status: normalizedStatus, warning: "Refund request was created; order summary needs reconciliation." });
  }
  const committedPaise = (refundRows ?? []).filter((r: { status: string }) => r.status === "processed").reduce((sum: number, r: { amount_paise: number }) => sum + Number(r.amount_paise), 0);
  const pendingPaise = (refundRows ?? []).filter((r: { status: string }) => r.status === "requested").reduce((sum: number, r: { amount_paise: number }) => sum + Number(r.amount_paise), 0);
  const orderStatus = committedPaise >= reservation.order_amount_paise ? "refunded" : committedPaise > 0 ? "partially_refunded" : "paid";
  const { error: orderUpdateError } = await ctx.supabaseAdmin.from("orders").update({ razorpay_status: orderStatus }).eq("id", body.orderId).eq("payment_gateway", "razorpay");
  if (orderUpdateError) {
    console.error("Refund saved, but order refund status could not be updated:", orderUpdateError);
    return jsonResponse({ ok: true, refundRequestId: reservation.refund_id, razorpayRefundId: gatewayRefund.id, status: normalizedStatus, warning: "Refund request was created; order summary needs reconciliation." });
  }
  return jsonResponse({
    ok: true, refundRequestId: reservation.refund_id, razorpayRefundId: gatewayRefund.id,
    status: normalizedStatus, amountPaise, pendingRefundPaise: pendingPaise,
    message: normalizedStatus === "processed" ? "Refund processed by Razorpay." : "Refund requested; final status may update asynchronously.",
  });
}));
