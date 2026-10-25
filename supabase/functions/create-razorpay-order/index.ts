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
function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}
function rupeesToPaise(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}
function validEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && value.length <= 254;
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req.headers.get("Origin")) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return json(req, { error: "Razorpay is not configured on the server." }, 503);

  const { data: auth, error: authError } = await ctx.supabase.auth.getUser();
  if (authError || !auth.user) return json(req, { error: "Please sign in before checkout." }, 401);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 16_384) return json(req, { error: "Request is too large." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json(req, { error: "Invalid request body." }, 400);
  }

  if (!validText(body.productId, 80) || !validText(body.fullName, 100) ||
      !validText(body.email, 254) || !validText(body.whatsapp, 24)) {
    return json(req, { error: "Please provide valid product and customer details." }, 400);
  }
  const email = body.email.trim();
  if (!validEmail(email) || !/^[0-9+\-\s]{8,16}$/.test(body.whatsapp.trim())) {
    return json(req, { error: "Please provide a valid email and WhatsApp number." }, 400);
  }

  const { data: product, error: productError } = await ctx.supabaseAdmin
    .from("products")
    .select("id,title,price,discounted_price,is_free,is_active,product_type")
    .eq("id", body.productId.trim())
    .maybeSingle();
  if (productError) {
    console.error("Razorpay product lookup failed:", productError);
    return json(req, { error: "Could not load this product." }, 500);
  }
  if (!product || !product.is_active || product.is_free || !["pdf", "physical"].includes(product.product_type)) {
    return json(req, { error: "This product is unavailable for purchase." }, 404);
  }

  const listedPrice = Number(product.price ?? 0);
  const discountedPrice = product.discounted_price == null ? null : Number(product.discounted_price);
  const subtotal = discountedPrice !== null && Number.isFinite(discountedPrice) && discountedPrice >= 0 && discountedPrice <= listedPrice
    ? discountedPrice
    : listedPrice;
  if (!Number.isFinite(subtotal) || subtotal <= 0 || subtotal > 1_000_000) {
    return json(req, { error: "This product has an invalid price. Please contact support." }, 400);
  }

  let total = Math.round(subtotal * 100) / 100;
  let couponCode: string | null = null;
  let couponDiscount = 0;
  if (typeof body.couponCode === "string" && body.couponCode.trim()) {
    const { data: quote, error: couponError } = await ctx.supabase.rpc("validate_coupon", {
      p_code: body.couponCode.trim(),
      p_product_id: product.id,
      p_subtotal: subtotal,
    });
    if (couponError) {
      console.error("Razorpay coupon validation failed:", couponError);
      return json(req, { error: "Coupon validation is temporarily unavailable. Please retry." }, 503);
    }
    if (!quote?.valid) return json(req, { error: "The coupon is no longer valid. Refresh checkout and try again." }, 400);
    total = Number(quote.total);
    couponDiscount = Number(quote.discountAmount ?? 0);
    couponCode = String(quote.code ?? body.couponCode).slice(0, 64);
  }
  if (!Number.isFinite(total) || total <= 0) {
    return json(req, { error: "The final payable amount must be greater than zero." }, 400);
  }
  const amountPaise = rupeesToPaise(total);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    return json(req, { error: "The payable amount is invalid." }, 400);
  }

  total = amountPaise / 100;
  const shipping = product.product_type === "physical";
  const optionalText = (v: unknown, max: number) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  if (shipping && (!validText(body.deliveryAddress, 300) || !validText(body.deliveryCity, 100) ||
      !validText(body.deliveryState, 100) || !/^[0-9]{5,10}$/.test(String(body.deliveryPostalCode ?? "").trim()))) {
    return json(req, { error: "A complete shipping address is required for this physical product." }, 400);
  }

  const { data: order, error: orderError } = await ctx.supabaseAdmin
    .from("orders")
    .insert({
      user_id: auth.user.id,
      product_id: product.id,
      product_type: product.product_type,
      product_title: product.title,
      full_name: body.fullName.trim(),
      email,
      whatsapp: body.whatsapp.trim(),
      delivery_address: shipping ? optionalText(body.deliveryAddress, 300) : null,
      delivery_city: shipping ? optionalText(body.deliveryCity, 100) : null,
      delivery_state: shipping ? optionalText(body.deliveryState, 100) : null,
      delivery_postal_code: shipping ? optionalText(body.deliveryPostalCode, 10) : null,
      delivery_country: shipping ? optionalText(body.deliveryCountry, 100) ?? "India" : null,
      amount: total,
      coupon_code: couponCode,
      coupon_discount: couponDiscount,
      payment_method: "Razorpay",
      payment_gateway: "razorpay",
      payment_status: "pending",
      order_status: "pending_payment",
      razorpay_status: "created",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Razorpay order record creation failed:", orderError);
    return json(req, { error: "Could not create your order. Please retry." }, 500);
  }

  const receipt = `ew_${order.id.replaceAll("-", "").slice(0, 24)}`;
  let gatewayResponse: Response;
  try {
    gatewayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes: { internal_order_id: order.id } }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Razorpay order API request failed:", error);
    await ctx.supabaseAdmin.from("orders").update({ razorpay_status: "failed" }).eq("id", order.id);
    return json(req, { error: "Payment service is temporarily unavailable. You can safely retry checkout." }, 502);
  }

  const gatewayOrder = await gatewayResponse.json().catch(() => null);
  if (!gatewayResponse.ok || typeof gatewayOrder?.id !== "string" ||
      gatewayOrder.amount !== amountPaise || gatewayOrder.currency !== "INR") {
    console.error("Razorpay order API rejected request:", gatewayResponse.status, gatewayOrder?.error?.code);
    await ctx.supabaseAdmin.from("orders").update({ razorpay_status: "failed" }).eq("id", order.id);
    return json(req, { error: "Payment service could not create the payment session. Please retry." }, 502);
  }

  const { error: updateError } = await ctx.supabaseAdmin.from("orders")
    .update({ razorpay_order_id: gatewayOrder.id })
    .eq("id", order.id);
  if (updateError) {
    console.error("Failed to attach Razorpay order ID:", updateError);
    return json(req, { error: "Payment session could not be saved. Contact support before retrying." }, 500);
  }

  return json(req, {
    orderId: order.id,
    razorpayOrderId: gatewayOrder.id,
    amount: amountPaise,
    currency: "INR",
    keyId,
    name: product.title,
    prefill: { name: body.fullName.trim(), email, contact: body.whatsapp.trim() },
  }, 201);
}));
