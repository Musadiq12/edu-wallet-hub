import { withSupabase } from "npm:@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "verify" | "resend";

type RequestBody = {
  orderId?: string;
  action?: Action;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

    const { data: role, error: roleError } = await ctx.supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userClaims?.sub ?? "")
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !role) return json({ error: "Administrator access required." }, 403);

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const orderId = body.orderId?.trim();
    const action: Action = body.action === "resend" ? "resend" : "verify";

    if (!orderId) return json({ error: "Order ID is required." }, 400);

    const { data: order, error: orderError } = await ctx.supabaseAdmin
      .from("orders")
      .select(
        "id,user_id,product_id,product_title,full_name,email,amount,payment_status,order_status,verified_at,delivered_at",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error(orderError);
      return json({ error: "Could not load the order." }, 500);
    }
    if (!order) return json({ error: "Order not found." }, 404);

    if (action === "resend" && order.payment_status !== "verified") {
      return json({ error: "The payment must be verified before the document can be sent." }, 400);
    }

    if (action === "verify" && order.payment_status === "verified") {
      return json({ error: "This payment is already verified. Use Resend Document if needed." }, 400);
    }

    if (!order.product_id) {
      return json({ error: "This order has no linked product." }, 400);
    }

    const { data: product, error: productError } = await ctx.supabaseAdmin
      .from("products")
      .select("id,title,pdf_file,is_free")
      .eq("id", order.product_id)
      .maybeSingle();

    if (productError) {
      console.error(productError);
      return json({ error: "Could not load the purchased product." }, 500);
    }

    if (!product?.pdf_file || product.is_free) {
      return json({ error: "The purchased product does not have a paid PDF available for delivery." }, 400);
    }

    const { data: signed, error: signedError } = await ctx.supabaseAdmin.storage
      .from("product-files")
      .createSignedUrl(product.pdf_file, 60 * 60 * 48);

    if (signedError || !signed?.signedUrl) {
      console.error(signedError);
      return json({ error: "Could not create a secure download link." }, 500);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("EDUWALLET_FROM_EMAIL");

    if (!resendApiKey || !fromEmail) {
      return json({
        error:
          "Email delivery is not configured. Add RESEND_API_KEY and EDUWALLET_FROM_EMAIL to Supabase Edge Function secrets.",
      }, 500);
    }

    const customerName = escapeHtml(order.full_name || "Customer");
    const productTitle = escapeHtml(product.title || order.product_title);
    const amount = formatInr(Number(order.amount));
    const downloadUrl = signed.signedUrl;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
        "Idempotency-Key":
          action === "verify"
            ? `edu-wallet-order-${order.id}-verified-${order.verified_at ?? Date.now()}`
            : `edu-wallet-order-${order.id}-resend-${Date.now()}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [order.email],
        subject: `Your Edu Wallet purchase is ready — ${product.title}`,
        html: `<!doctype html>
<html>
  <body style="margin:0;background:#f6f8fb;font-family:Arial,sans-serif;color:#172033;">
    <div style="max-width:600px;margin:32px auto;padding:0 16px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 16px;font-size:24px;">Payment confirmed</h1>
        <p style="font-size:15px;line-height:1.6;">Hello ${customerName},</p>
        <p style="font-size:15px;line-height:1.6;">
          Your payment for <strong>${productTitle}</strong> has been verified successfully.
        </p>
        <div style="background:#f6f8fb;border-radius:8px;padding:16px;margin:20px 0;">
          <div style="font-size:14px;color:#667085;">Amount paid</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px;">${amount}</div>
        </div>
        <p style="margin:24px 0;">
          <a href="${downloadUrl}" style="display:inline-block;background:#173b72;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:7px;font-weight:600;">
            Download your PDF
          </a>
        </p>
        <p style="font-size:12px;line-height:1.5;color:#667085;">
          This secure download link expires in 48 hours. If it expires, contact support or ask the administrator to resend your document.
        </p>
        <p style="font-size:14px;line-height:1.6;margin-top:24px;">
          Thank you for using Edu Wallet.
        </p>
      </div>
    </div>
  </body>
</html>`,
      }),
    });

    if (!emailResponse.ok) {
      const details = await emailResponse.text();
      console.error("Resend error:", details);
      return json({ error: "The payment was not delivered by email. Use Resend Document to try again." }, 502);
    }

    const deliveredAt = new Date().toISOString();

    if (action === "verify") {
      const { error: updateError } = await ctx.supabaseAdmin
        .from("orders")
        .update({
          payment_status: "verified",
          order_status: "delivered",
          verified_at: order.verified_at ?? deliveredAt,
          delivered_at: deliveredAt,
        })
        .eq("id", order.id);

      if (updateError) {
        console.error(updateError);
        return json({ error: "Email sent, but the order status could not be updated. Please check the order before retrying." }, 500);
      }
    } else {
      const { error: updateError } = await ctx.supabaseAdmin
        .from("orders")
        .update({
          order_status: "delivered",
          delivered_at: deliveredAt,
        })
        .eq("id", order.id);

      if (updateError) console.error("Delivery status update failed:", updateError);
    }

    return json({
      ok: true,
      message: action === "verify" ? "Payment verified and document emailed." : "Document resent successfully.",
    });
  }),
};
