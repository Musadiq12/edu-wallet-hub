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

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

type CheckoutOrder = {
  id: string;
  amount: number | string;
  product_title: string;
  full_name: string;
  email: string;
  whatsapp: string;
};

type ExistingCheckoutOrder = CheckoutOrder & {
  user_id: string;
  product_id: string | null;
  product_type: string;
  payment_status: string;
  order_status: string;
  payment_gateway: string;
  razorpay_order_id: string | null;
  razorpay_status: string;
  checkout_idempotency_key: string | null;
  razorpay_creation_started_at: string | null;
  created_at: string;
  coupon_code: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_postal_code: string | null;
  delivery_country: string | null;
  estimated_delivery: string | null;
  inventory_reserved: boolean;
  inventory_deducted: boolean;
  inventory_released: boolean;
};

const IDEMPOTENCY_ORDER_FIELDS =
  "id,user_id,product_id,product_type,product_title,full_name,email,whatsapp,amount,payment_status,order_status,payment_gateway,razorpay_order_id,razorpay_status,checkout_idempotency_key,razorpay_creation_started_at,created_at,coupon_code,delivery_address,delivery_city,delivery_state,delivery_postal_code,delivery_country,estimated_delivery,inventory_reserved,inventory_deducted,inventory_released";

type GatewayOrderResult =
  | { ok: true; id: string }
  | { ok: false; status: 502; message: string; preserveClaim: boolean };

async function createGatewayOrder(
  orderId: string,
  amountPaise: number,
  keyId: string,
  keySecret: string,
): Promise<GatewayOrderResult> {
  const receipt = `ew_${orderId.replaceAll("-", "").slice(0, 24)}`;
  const authorization = `Basic ${btoa(`${keyId}:${keySecret}`)}`;

  const recoverOrderByReceipt = async (): Promise<string | null> => {
    let lookupResponse: Response;
    try {
      lookupResponse = await fetch(
        `https://api.razorpay.com/v1/orders?receipt=${encodeURIComponent(receipt)}&count=10`,
        {
          headers: { Authorization: authorization },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch (error) {
      console.error("Razorpay receipt recovery request failed:", error);
      return null;
    }

    if (!lookupResponse.ok) {
      console.error("Razorpay receipt recovery rejected request:", lookupResponse.status);
      return null;
    }

    const lookup = await lookupResponse.json().catch(() => null);
    const items = Array.isArray(lookup?.items) ? lookup.items : [];
    const existing = items.find((item: Record<string, unknown>) =>
      item.receipt === receipt &&
      item.amount === amountPaise &&
      item.currency === "INR" &&
      item.notes !== null &&
      typeof item.notes === "object" &&
      (item.notes as Record<string, unknown>).internal_order_id === orderId &&
      typeof item.id === "string" &&
      /^order_[A-Za-z0-9]+$/.test(item.id)
    );

    return existing?.id ?? null;
  };

  let response: Response;
  try {
    response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: { internal_order_id: orderId },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Razorpay order API request failed:", error);
    const recoveredId = await recoverOrderByReceipt();
    if (recoveredId) return { ok: true, id: recoveredId };
    // The request may have reached Razorpay even when the response was lost.
    // Keep the creation lease so a retry reconciles by the unique receipt first.
    return {
      ok: false,
      status: 502,
      preserveClaim: true,
      message: "Payment service did not confirm whether the order was created. Retry this checkout shortly; do not start a separate payment.",
    };
  }

  const payload = await response.json().catch(() => null);
  if (
    response.ok &&
    typeof payload?.id === "string" &&
    /^order_[A-Za-z0-9]+$/.test(payload.id) &&
    payload.amount === amountPaise &&
    payload.currency === "INR" &&
    payload.receipt === receipt
  ) {
    return { ok: true, id: payload.id };
  }

  const description = String(payload?.error?.description ?? payload?.error?.reason ?? "");
  const duplicateReceipt = /receipt.*(already|unique|created|duplicate)|duplicate.*receipt|already been processed/i.test(description);
  const ambiguousResponse = response.status >= 500 || response.status === 408 || duplicateReceipt;

  if (ambiguousResponse) {
    const recoveredId = await recoverOrderByReceipt();
    if (recoveredId) return { ok: true, id: recoveredId };
  }

  console.error("Razorpay order API rejected request:", response.status, payload?.error?.code);
  return {
    ok: false,
    status: 502,
    preserveClaim: ambiguousResponse,
    message: ambiguousResponse
      ? "Payment service could not confirm the existing order. Retry this checkout shortly; do not start a separate payment."
      : "Payment service could not create the payment session. Correct the checkout problem or contact support before retrying.",
  };
}

function checkoutResponse(
  req: Request,
  order: CheckoutOrder,
  razorpayOrderId: string,
  keyId: string,
  amountPaise: number,
  status = 200,
) {
  return json(req, {
    orderId: order.id,
    razorpayOrderId,
    amount: amountPaise,
    currency: "INR",
    keyId,
    name: order.product_title,
    prefill: { name: order.full_name, email: order.email, contact: order.whatsapp },
  }, status);
}

Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req.headers.get("Origin")) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return json(req, { error: "Razorpay is not configured on the server." }, 503);

  const { data: auth, error: authError } = await ctx.supabase.auth.getUser();
  if (authError || !auth.user) return json(req, { error: "Please sign in before checkout." }, 401);

  const createAndAttachGatewayOrder = async (
    order: CheckoutOrder,
    amountPaise: number,
    successStatus = 201,
  ) => {
    const gateway = await createGatewayOrder(order.id, amountPaise, keyId, keySecret);
    if (!gateway.ok) {
      if (!gateway.preserveClaim) {
        const { error: markFailedError } = await ctx.supabaseAdmin
          .from("orders")
          .update({ razorpay_status: "failed", razorpay_creation_started_at: null })
          .eq("id", order.id)
          .eq("razorpay_status", "creating")
          .is("razorpay_order_id", null);
        if (markFailedError) console.error("Failed to record Razorpay order creation failure:", markFailedError);
      }
      return json(req, { error: gateway.message }, gateway.status);
    }

    const { data: attached, error: attachError } = await ctx.supabaseAdmin
      .from("orders")
      .update({
        razorpay_order_id: gateway.id,
        razorpay_status: "created",
        razorpay_creation_started_at: null,
      })
      .eq("id", order.id)
      .eq("razorpay_status", "creating")
      .is("razorpay_order_id", null)
      .select("id")
      .maybeSingle();

    if (attachError || !attached) {
      const { data: latest } = await ctx.supabaseAdmin
        .from("orders")
        .select("razorpay_order_id,razorpay_status")
        .eq("id", order.id)
        .maybeSingle();

      if (latest?.razorpay_order_id === gateway.id && latest.razorpay_status === "created") {
        return checkoutResponse(req, order, gateway.id, keyId, amountPaise, 200);
      }

      const { error: markFailedError } = await ctx.supabaseAdmin
        .from("orders")
        .update({ razorpay_status: "failed", razorpay_creation_started_at: null })
        .eq("id", order.id)
        .eq("razorpay_status", "creating")
        .is("razorpay_order_id", null);
      if (markFailedError) console.error("Could not clear the failed checkout claim:", markFailedError);

      console.error("Failed to attach Razorpay order ID:", attachError);
      return json(req, {
        error: "Payment session could not be safely saved. Retry this checkout; do not pay again if a payment window already opened.",
      }, 500);
    }

    return checkoutResponse(req, order, gateway.id, keyId, amountPaise, successStatus);
  };


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
  const productId = body.productId.trim();
  const whatsapp = body.whatsapp.trim();
  const suppliedIdempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (suppliedIdempotencyKey && !validUuid(suppliedIdempotencyKey)) {
    return json(req, { error: "Checkout attempt identifier is invalid. Refresh checkout and try again." }, 400);
  }
  // Older deployed clients don't send this field; generate a valid key for backward compatibility.
  const idempotencyKey = suppliedIdempotencyKey || crypto.randomUUID();
  if (!validEmail(email) || !/^[0-9+\-\s]{8,16}$/.test(whatsapp)) {
    return json(req, { error: "Please provide a valid email and WhatsApp number." }, 400);
  }

  const { data: existingRaw, error: existingLookupError } = await ctx.supabaseAdmin
    .from("orders")
    .select(IDEMPOTENCY_ORDER_FIELDS)
    .eq("user_id", auth.user.id)
    .eq("checkout_idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingLookupError) {
    console.error("Razorpay idempotency lookup failed:", existingLookupError);
    return json(req, { error: "Could not safely resume this checkout. Please retry shortly." }, 500);
  }

  if (existingRaw) {
    const existing = existingRaw as ExistingCheckoutOrder;
    const requestedCoupon = typeof body.couponCode === "string" && body.couponCode.trim()
      ? body.couponCode.trim().toUpperCase()
      : null;
    const storedCoupon = existing.coupon_code?.trim().toUpperCase() ?? null;
    const formMatches =
      existing.product_id === productId &&
      existing.full_name === body.fullName.trim() &&
      existing.email === email &&
      existing.whatsapp === whatsapp &&
      storedCoupon === requestedCoupon &&
      (existing.product_type !== "physical" || (
        existing.delivery_address === optionalText(body.deliveryAddress, 300) &&
        existing.delivery_city === optionalText(body.deliveryCity, 100) &&
        existing.delivery_state === optionalText(body.deliveryState, 100) &&
        existing.delivery_postal_code === optionalText(body.deliveryPostalCode, 10) &&
        existing.delivery_country === (optionalText(body.deliveryCountry, 100) ?? "India")
      ));

    if (!formMatches) {
      return json(req, { error: "Checkout details changed. Start a new checkout attempt before paying." }, 409);
    }

    if (existing.product_type === "physical" && existing.inventory_released) {
      return json(req, { error: "This checkout reservation was released. Refresh the product page and start a new checkout." }, 409);
    }

    if (
      existing.payment_status === "verified" ||
      ["paid", "fulfilled", "partially_refunded", "refunded"].includes(existing.razorpay_status)
    ) {
      return json(req, {
        error: "This checkout has already been paid or is no longer payable. Refresh the page and check your order; do not pay again.",
      }, 409);
    }

    if (existing.razorpay_order_id && existing.razorpay_status === "created") {
      const existingAmountPaise = rupeesToPaise(Number(existing.amount));
      if (!Number.isSafeInteger(existingAmountPaise) || existingAmountPaise < 100) {
        return json(req, { error: "This checkout has an invalid saved amount. Please contact support before paying." }, 409);
      }
      return checkoutResponse(req, existing, existing.razorpay_order_id, keyId, existingAmountPaise, 200);
    }

    // A failed or stale creation may be retried using the same internal order. Claim it atomically
    // so two simultaneous retries cannot create separate Razorpay sessions.
    const now = new Date().toISOString();
    let claimQuery = ctx.supabaseAdmin
      .from("orders")
      .update({ razorpay_status: "creating", razorpay_creation_started_at: now })
      .eq("id", existing.id)
      .is("razorpay_order_id", null);

    if (existing.razorpay_status === "failed") {
      claimQuery = claimQuery.eq("razorpay_status", "failed");
    } else if (existing.razorpay_status === "creating") {
      const startedAt = existing.razorpay_creation_started_at || existing.created_at;
      if (Date.now() - new Date(startedAt).getTime() < 45_000) {
        return json(req, { error: "This checkout is still being prepared. Wait briefly, then retry using this same page. Do not pay again yet." }, 409);
      }
      claimQuery = claimQuery.eq("razorpay_status", "creating");
      if (existing.razorpay_creation_started_at) {
        claimQuery = claimQuery.eq("razorpay_creation_started_at", existing.razorpay_creation_started_at);
      } else {
        claimQuery = claimQuery.is("razorpay_creation_started_at", null);
      }
    } else {
      return json(req, { error: "This checkout is already being processed. Retry shortly or contact support; do not pay again." }, 409);
    }

    const { data: claimedRaw, error: claimError } = await claimQuery
      .select(IDEMPOTENCY_ORDER_FIELDS)
      .maybeSingle();

    if (claimError) {
      console.error("Could not claim Razorpay checkout retry:", claimError);
      return json(req, { error: "Could not safely retry this checkout. Please try again shortly." }, 500);
    }
    if (!claimedRaw) {
      const { data: latestRaw } = await ctx.supabaseAdmin
        .from("orders")
        .select(IDEMPOTENCY_ORDER_FIELDS)
        .eq("id", existing.id)
        .maybeSingle();
      const latest = latestRaw as ExistingCheckoutOrder | null;
      if (latest?.razorpay_order_id && latest.razorpay_status === "created") {
        const latestAmountPaise = rupeesToPaise(Number(latest.amount));
        if (Number.isSafeInteger(latestAmountPaise) && latestAmountPaise >= 100) {
          return checkoutResponse(req, latest, latest.razorpay_order_id, keyId, latestAmountPaise, 200);
        }
      }
      return json(req, { error: "Another request is already preparing this checkout. Retry in a moment without paying again." }, 409);
    }

    const claimed = claimedRaw as ExistingCheckoutOrder;
    const recoveryAmountPaise = rupeesToPaise(Number(claimed.amount));
    if (!Number.isSafeInteger(recoveryAmountPaise) || recoveryAmountPaise < 100) {
      await ctx.supabaseAdmin.from("orders")
        .update({ razorpay_status: "failed", razorpay_creation_started_at: null })
        .eq("id", claimed.id).eq("razorpay_status", "creating").is("razorpay_order_id", null);
      return json(req, { error: "This checkout has an invalid saved amount. Please contact support before paying." }, 409);
    }

    return await createAndAttachGatewayOrder(claimed, recoveryAmountPaise, 200);
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
  if (shipping && (!validText(body.deliveryAddress, 300) || !validText(body.deliveryCity, 100) ||
      !validText(body.deliveryState, 100) || !/^[0-9]{5,10}$/.test(String(body.deliveryPostalCode ?? "").trim()))) {
    return json(req, { error: "A complete shipping address is required for this physical product." }, 400);
  }
  const estimatedDelivery = shipping && typeof body.estimatedDelivery === "string"
    ? body.estimatedDelivery.trim().slice(0, 120) || null
    : null;

  const { data: order, error: orderError } = await ctx.supabaseAdmin
    .from("orders")
    .insert({
      user_id: auth.user.id,
      checkout_idempotency_key: idempotencyKey,
      razorpay_creation_started_at: new Date().toISOString(),
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
      estimated_delivery: estimatedDelivery,
      // The database coupon trigger validates and deducts the discount on INSERT.
      // Store the pre-discount subtotal here so the discount is applied exactly once.
      amount: subtotal,
      coupon_code: couponCode,
      coupon_discount: 0,
      payment_method: "Razorpay",
      payment_gateway: "razorpay",
      payment_status: "pending",
      order_status: "pending_payment",
      razorpay_status: "creating",
    })
    .select("id,amount,product_title,full_name,email,whatsapp")
    .single();

  if (orderError || !order) {
    if (orderError?.code === "23505") {
      const { data: racedRaw, error: racedLookupError } = await ctx.supabaseAdmin
        .from("orders")
        .select(IDEMPOTENCY_ORDER_FIELDS)
        .eq("user_id", auth.user.id)
        .eq("checkout_idempotency_key", idempotencyKey)
        .maybeSingle();

      if (racedLookupError) {
        console.error("Could not resolve duplicate Razorpay checkout request:", racedLookupError);
        return json(req, { error: "Checkout is already being processed. Retry shortly; do not pay again." }, 409);
      }

      const raced = racedRaw as ExistingCheckoutOrder | null;
      if (raced?.razorpay_order_id && raced.razorpay_status === "created") {
        const racedAmountPaise = rupeesToPaise(Number(raced.amount));
        if (Number.isSafeInteger(racedAmountPaise) && racedAmountPaise >= 100) {
          return checkoutResponse(req, raced, raced.razorpay_order_id, keyId, racedAmountPaise, 200);
        }
      }

      return json(req, { error: "This checkout is already being prepared. Retry in a moment without paying again." }, 409);
    }

    const couponErrors: Record<string, string> = {
      USAGE_LIMIT_REACHED: "This coupon has already been used on your account or has reached its usage limit. Remove it and retry without the coupon.",
      COUPON_EXPIRED: "This coupon is no longer active. Remove it and try another code.",
      COUPON_NOT_FOUND: "This coupon code is not valid. Remove it and retry.",
      MIN_SUBTOTAL_NOT_MET: "Your order no longer meets this coupon's minimum subtotal. Remove it or update your order.",
      NOT_ELIGIBLE_FOR_CART: "This coupon does not apply to this product or account.",
    };
    const matchedCouponError = Object.entries(couponErrors).find(([code]) =>
      (orderError?.message ?? "").includes(code)
    );
    if (matchedCouponError) {
      return json(req, { error: matchedCouponError[1] }, 409);
    }

    if ((orderError?.message ?? "").includes("OUT_OF_STOCK")) {
      return json(req, { error: "This physical product has just sold out or does not have enough stock. Please refresh the product page." }, 409);
    }
    console.error("Razorpay order record creation failed:", orderError);
    return json(req, { error: "Could not create your order. Please retry." }, 500);
  }

  return await createAndAttachGatewayOrder(order as CheckoutOrder, amountPaise, 201);
}));
