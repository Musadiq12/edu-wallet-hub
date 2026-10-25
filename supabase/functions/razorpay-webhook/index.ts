import { withSupabase } from "npm:@supabase/server";

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
  const supported = ["payment.captured", "order.paid", "payment.failed"];
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
    if (eventInsertError.code === "23505") return response({ ok: true, duplicate: true });
    console.error("Could not persist Razorpay webhook event:", eventInsertError);
    return response({ error: "Webhook event could not be recorded; retry later." }, 500);
  }

  try {
    if (!gatewayOrderId) {
      throw new Error("Webhook payload did not include a Razorpay order ID.");
    }

    const { data: order, error: orderError } = await ctx.supabaseAdmin
      .from("orders")
      .select("id,amount,payment_status,order_status,razorpay_status,razorpay_payment_id")
      .eq("payment_gateway", "razorpay")
      .eq("razorpay_order_id", gatewayOrderId)
      .maybeSingle();

    if (orderError) throw new Error("Could not look up the local order.");
    if (!order) {
      // An event may arrive before the application persists the gateway order ID.
      throw new Error("No local order currently matches this Razorpay order ID.");
    }

    if (eventType === "payment.failed") {
      if (order.razorpay_status !== "paid" && order.razorpay_status !== "fulfilled") {
        const { error } = await ctx.supabaseAdmin.from("orders")
          .update({
            razorpay_status: "failed",
            payment_status: "rejected",
            order_status: "payment_rejected",
          })
          .eq("id", order.id)
          .eq("razorpay_status", "created");
        if (error) throw new Error("Could not record failed payment status.");
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
