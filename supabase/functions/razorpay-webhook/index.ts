import { withSupabase } from "npm:@supabase/server";

const EDUWALLET_FROM_EMAIL = "EduWallet Support <support@eduwallethub.in>";
const EDUWALLET_REPLY_TO = "support@eduwallethub.in";

const encoder = new TextEncoder();

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function sendDeliveryEmail(args: {
  apiKey: string; from: string; to: string; orderId: string;
  customerName: string; productTitle: string; amount: number; downloadUrl: string;
}) {
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(args.amount);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
      "Idempotency-Key": `edu-wallet-order-${args.orderId}-razorpay-delivery`,
    },
    body: JSON.stringify({
      from: args.from,
      reply_to: EDUWALLET_REPLY_TO,
      to: [args.to],
      subject: `Your EduWallet purchase is ready — ${args.productTitle}`,
      html: `<p>Hello ${escapeHtml(args.customerName)},</p><p>Your payment for <strong>${escapeHtml(args.productTitle)}</strong> is confirmed.</p><p>Amount paid: ${amount}</p><p><a href="${args.downloadUrl}">Download your PDF</a></p><p>This secure link expires in 48 hours. Contact support if it expires.</p><p>Thank you for using EduWallet.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error("Razorpay delivery email failed:", await response.text());
    throw new Error("Delivery email failed and can be retried.");
  }
}

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: Record<string, unknown> };
    order?: { entity?: Record<string, unknown> };
  };
};

Deno.serve(withSupabase({ auth: "none" }, async (req, ctx) => {
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not configured.");
    return response({ error: "Webhook is not configured." }, 503);
  }

  const signature = req.headers.get("x-razorpay-signature")?.trim().toLowerCase();
  const eventId = req.headers.get("x-razorpay-event-id")?.trim();
  if (!signature || !/^[a-f0-9]{64}$/.test(signature) || !eventId || eventId.length > 200) {
    return response({ error: "Missing or invalid webhook signature/event ID." }, 400);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return response({ error: "Could not read webhook body." }, 400);
  }
  if (rawBody.length > 1_000_000) return response({ error: "Webhook body too large." }, 413);

  const expectedSignature = await hmacHex(webhookSecret, rawBody);
  if (!safeEqual(expectedSignature, signature)) {
    return response({ error: "Invalid webhook signature." }, 401);
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return response({ error: "Invalid JSON payload." }, 400);
  }

  const eventType = typeof event.event === "string" ? event.event : "";
  const supported = ["payment.captured", "order.paid", "payment.failed", "refund.processed", "refund.failed"];
  if (!supported.includes(eventType)) {
    // Validly signed but unsupported events are acknowledged to prevent pointless retries.
    return response({ ok: true, ignored: true });
  }

  const payment = event.payload?.payment?.entity ?? {};
  const gatewayOrder = event.payload?.order?.entity ?? {};
  const paymentId = typeof payment.id === "string" ? payment.id : null;
  const orderIdFromPayment = typeof payment.order_id === "string" ? payment.order_id : null;
  const gatewayOrderId = orderIdFromPayment ??
    (typeof gatewayOrder.id === "string" ? gatewayOrder.id : null);
  const currency = typeof payment.currency === "string" ? payment.currency :
    typeof gatewayOrder.currency === "string" ? gatewayOrder.currency : null;
  const amount = typeof payment.amount === "number" ? payment.amount :
    typeof gatewayOrder.amount_paid === "number" ? gatewayOrder.amount_paid : null;
  const paymentStatus = typeof payment.status === "string" ? payment.status : null;

  const { error: eventInsertError } = await ctx.supabaseAdmin
    .from("razorpay_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      razorpay_order_id: gatewayOrderId,
      razorpay_payment_id: paymentId,
    });

  if (eventInsertError) {
    if (eventInsertError.code !== "23505") {
      console.error("Could not persist Razorpay webhook event:", eventInsertError);
      return response({ error: "Webhook event could not be recorded; retry later." }, 500);
    }
    const { data: existingEvent, error: existingEventError } = await ctx.supabaseAdmin
      .from("razorpay_webhook_events")
      .select("processed_at,processing_error")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existingEventError) return response({ error: "Could not inspect duplicate webhook event." }, 500);
    if (existingEvent?.processed_at) return response({ ok: true, duplicate: true });
    // A previous attempt inserted the event but failed before completion. Reprocess it.
  }

  try {
    if (eventType === "refund.processed" || eventType === "refund.failed") {
      const refundEntity = (event.payload as { refund?: { entity?: Record<string, unknown> } } | undefined)?.refund?.entity ?? {};
      const refundId = typeof refundEntity.id === "string" ? refundEntity.id : null;
      const refundPaymentId = typeof refundEntity.payment_id === "string" ? refundEntity.payment_id : null;
      if (!refundId || !refundPaymentId) throw new Error("Refund webhook payload is missing refund or payment ID.");
      const { data: refundRow, error: refundLookupError } = await ctx.supabaseAdmin.from("razorpay_refunds").select("id,order_id").eq("razorpay_refund_id", refundId).maybeSingle();
      if (refundLookupError) throw new Error("Could not look up local refund.");
      if (!refundRow) throw new Error("No local refund matches this Razorpay refund ID.");
      const { data: relatedOrder, error: relatedOrderError } = await ctx.supabaseAdmin.from("orders").select("id,amount,razorpay_payment_id,razorpay_status").eq("id", refundRow.order_id).maybeSingle();
      if (relatedOrderError || !relatedOrder || relatedOrder.razorpay_payment_id !== refundPaymentId) throw new Error("Refund payment does not match its local order.");
      const newStatus = eventType === "refund.processed" ? "processed" : "failed";
      const { error: updateRefundError } = await ctx.supabaseAdmin.from("razorpay_refunds").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", refundRow.id);
      if (updateRefundError) throw new Error("Could not update refund status.");
      const { data: refunds, error: totalsError } = await ctx.supabaseAdmin.from("razorpay_refunds").select("amount_paise,status").eq("order_id", refundRow.order_id);
      if (totalsError) throw new Error("Could not recalculate refund totals.");
      const processedPaise = (refunds ?? []).filter((r: {status:string}) => r.status === "processed").reduce((sum: number, r: {amount_paise:number}) => sum + Number(r.amount_paise), 0);
      const totalPaise = Math.round(Number(relatedOrder.amount) * 100);
      const nextStatus = processedPaise >= totalPaise ? "refunded" : processedPaise > 0 ? "partially_refunded" : relatedOrder.razorpay_status === "fulfilled" ? "fulfilled" : "paid";
      const { error: updateOrderError } = await ctx.supabaseAdmin.from("orders").update({ razorpay_status: nextStatus }).eq("id", relatedOrder.id).eq("payment_gateway", "razorpay");
      if (updateOrderError) throw new Error("Refund saved but order status could not be updated.");
      const { error: processedError } = await ctx.supabaseAdmin.from("razorpay_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("event_id", eventId);
      if (processedError) throw new Error("Refund saved but webhook event could not be marked complete.");
      return response({ ok: true, refundStatus: newStatus });
    }
    if (!gatewayOrderId) {
      throw new Error("Webhook payload did not include a Razorpay order ID.");
    }

    const { data: order, error: orderError } = await ctx.supabaseAdmin
      .from("orders")
      .select("id,user_id,product_id,product_type,product_title,full_name,email,amount,payment_status,order_status,razorpay_status,razorpay_payment_id,verified_at,delivered_at")
      .eq("payment_gateway", "razorpay")
      .eq("razorpay_order_id", gatewayOrderId)
      .maybeSingle();

    if (orderError) throw new Error("Could not look up the local order.");
    if (!order) {
      // An event may arrive before the application persists the gateway order ID.
      throw new Error("No local order currently matches this Razorpay order ID.");
    }

    if (eventType === "payment.failed") {
      // A failed attempt does not mean the Razorpay order itself is unusable;
      // customers may retry with another payment method. Keep the order retryable.
      if (order.razorpay_status === "paid" || order.razorpay_status === "fulfilled") {
        // Ignore late failure events after a successful captured payment.
      }
    } else {
      const expectedPaise = Math.round((Number(order.amount) + Number.EPSILON) * 100);
      if (currency !== "INR" || amount !== expectedPaise || !paymentId) {
        throw new Error("Captured payment amount, currency, or payment ID did not match the order.");
      }
      if (eventType === "payment.captured" && paymentStatus !== "captured") {
        throw new Error("payment.captured event did not contain a captured payment.");
      }

      if (order.razorpay_status !== "fulfilled") {
        if (order.razorpay_status !== "paid" || order.razorpay_payment_id === paymentId) {
          const { error } = await ctx.supabaseAdmin.from("orders")
            .update({
              razorpay_payment_id: paymentId,
              transaction_id: paymentId,
              razorpay_status: "paid",
              payment_status: "verified",
              order_status: "payment_verified",
              status: "Payment Verified",
              verified_at: new Date().toISOString(),
            })
            .eq("id", order.id)
            .neq("razorpay_status", "fulfilled");
          if (error) throw new Error("Could not update the paid order.");
        } else {
          throw new Error("A different payment is already attached to this order.");
        }
      }
    }

    // Auto-deliver paid digital PDFs. Physical orders stay payment-verified for admin shipping.
    if (eventType !== "payment.failed" && order.product_type === "pdf" && order.razorpay_status !== "fulfilled") {
      const workerUrl = Deno.env.get("R2_WORKER_URL")?.replace(/\/$/, "");
      const deliverySecret = Deno.env.get("R2_WORKER_DELIVERY_SECRET");
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = EDUWALLET_FROM_EMAIL;
      if (!workerUrl || !deliverySecret) {
        throw new Error("PDF fulfilment requires R2 worker secrets.");
      }
      // A buyer may configure their own email provider after acquiring the site.
      // Record the payment event as handled, but leave the order paid (not fulfilled)
      // until email delivery is configured and the order can be fulfilled safely.
      if (!resendApiKey) {
        const message = "PDF email delivery deferred: RESEND_API_KEY is not configured.";
        const { error: deferredError } = await ctx.supabaseAdmin.from("razorpay_webhook_events")
          .update({ processed_at: new Date().toISOString(), processing_error: message })
          .eq("event_id", eventId);
        if (deferredError) throw new Error("Email delivery is deferred, but webhook event could not be marked complete.");
        return response({ ok: true, deliveryDeferred: true });
      }
      if (!order.product_id || !order.email) throw new Error("Order is missing product or customer email.");

      const { data: product, error: productError } = await ctx.supabaseAdmin
        .from("products").select("id,title,pdf_file,is_free,product_type")
        .eq("id", order.product_id).maybeSingle();
      if (productError) throw new Error("Could not load the purchased product.");
      if (!product || product.product_type !== "pdf" || product.is_free || !product.pdf_file) {
        throw new Error("Purchased PDF is unavailable for delivery.");
      }

      let pdfPath = product.pdf_file;
      if (!pdfPath.startsWith("products/")) {
        const migrationResponse = await fetch(workerUrl + "/migrate-legacy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Delivery-Secret": deliverySecret },
          body: JSON.stringify({ path: pdfPath }),
          signal: AbortSignal.timeout(20_000),
        });
        const migrationData = await migrationResponse.json().catch(() => null);
        if (!migrationResponse.ok || typeof migrationData?.path !== "string" || !migrationData.path.startsWith("products/")) {
          throw new Error("Could not migrate the purchased PDF to private R2 storage.");
        }
        pdfPath = migrationData.path;
        const { error: pathUpdateError } = await ctx.supabaseAdmin.from("products")
          .update({ pdf_file: pdfPath }).eq("id", product.id);
        if (pathUpdateError) throw new Error("Could not save the migrated PDF path.");
      }

      const linkResponse = await fetch(workerUrl + "/delivery-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Delivery-Secret": deliverySecret },
        body: JSON.stringify({ key: pdfPath, expiresIn: 48 * 60 * 60 }),
        signal: AbortSignal.timeout(10_000),
      });
      const linkData = await linkResponse.json().catch(() => null);
      if (!linkResponse.ok || typeof linkData?.url !== "string") throw new Error("Could not create a secure PDF link.");

      await sendDeliveryEmail({
        apiKey: resendApiKey, from: fromEmail, to: order.email, orderId: order.id,
        customerName: order.full_name || "Customer", productTitle: product.title || order.product_title,
        amount: Number(order.amount), downloadUrl: linkData.url,
      });

      const deliveredAt = new Date().toISOString();
      const { data: fulfilled, error: fulfilError } = await ctx.supabaseAdmin.from("orders").update({
        order_status: "delivered", status: "Payment Verified", payment_status: "verified",
        verified_at: order.verified_at ?? deliveredAt, delivered_at: deliveredAt, razorpay_status: "fulfilled",
      }).eq("id", order.id).eq("payment_status", "verified").neq("razorpay_status", "fulfilled").select("id").maybeSingle();
      if (fulfilError || !fulfilled) {
        throw new Error("Delivery email sent, but fulfilment status could not be saved.");
      }
    }

    const { error: processedError } = await ctx.supabaseAdmin
      .from("razorpay_webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("event_id", eventId);
    if (processedError) throw new Error("Order was updated but webhook completion could not be recorded.");

    return response({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook processing error.";
    console.error("Razorpay webhook processing failed:", { eventId, eventType, message });
    await ctx.supabaseAdmin.from("razorpay_webhook_events")
      .update({ processing_error: message.slice(0, 1000) })
      .eq("event_id", eventId);
    // Non-2xx lets Razorpay retry; event insertion and order transitions are idempotent.
    return response({ error: "Webhook processing failed; retry scheduled." }, 500);
  }
}));
