import { withSupabase } from "npm:@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "verify" | "resend" | "whatsapp";

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

    // Resolve the authenticated user directly from Supabase Auth instead of relying
    // on ctx.userClaims.sub, which may be absent with the current server SDK context.
    const { data: authUser, error: authUserError } = await ctx.supabase.auth.getUser();
    const userId = authUser.user?.id;

    if (authUserError || !userId) {
      console.error("Authenticated user lookup failed:", authUserError);
      return json({ error: "Could not identify the authenticated administrator." }, 401);
    }

    const { data: isAdmin, error: roleError } = await ctx.supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (roleError || isAdmin !== true) {
      console.error("Admin authorization failed:", roleError, { userId });
      return json({ error: "Administrator access required." }, 403);
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const orderId = body.orderId?.trim();
    const action: Action = body.action === "resend" ? "resend" : body.action === "whatsapp" ? "whatsapp" : "verify";

    if (!orderId) return json({ error: "Order ID is required." }, 400);

    const { data: order, error: orderError } = await ctx.supabaseAdmin
      .from("orders")
      .select(
        "id,user_id,product_id,product_type,product_title,full_name,email,amount,payment_status,order_status,verified_at,delivered_at",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error(orderError);
      return json({ error: "Could not load the order." }, 500);
    }
    if (!order) return json({ error: "Order not found." }, 404);

    if (order.product_type !== "pdf") {
      return json({ error: "This delivery workflow is only for digital PDF orders." }, 400);
    }

    if (action !== "verify" && (order.payment_status !== "verified" || order.order_status === "cancelled")) {
      return json({ error: "Only active, payment-verified PDF orders can be delivered." }, 400);
    }

    if (action === "verify" && (order.payment_status === "rejected" || order.order_status === "cancelled")) {
      return json({ error: "Cancelled or rejected orders cannot be delivered." }, 409);
    }
    if (action === "verify" && order.payment_status === "verified" && order.order_status === "delivered") {
      return json({ error: "This order has already been delivered. Use the WhatsApp action to share a fresh secure link." }, 409);
    }

    if (!order.product_id) {
      return json({ error: "This order has no linked product." }, 400);
    }

    const { data: product, error: productError } = await ctx.supabaseAdmin
      .from("products")
      .select("id,title,pdf_file,is_free,product_type")
      .eq("id", order.product_id)
      .maybeSingle();

    if (productError) {
      console.error(productError);
      return json({ error: "Could not load the purchased product." }, 500);
    }

    if (!product || product.product_type !== "pdf" || !product.pdf_file || product.is_free) {
      return json({ error: "The purchased product does not have a paid PDF available for delivery." }, 400);
    }

    if (action === "whatsapp") {
      const r2WorkerUrl = Deno.env.get("R2_WORKER_URL")?.replace(/\/$/, "");
      const deliverySecret = Deno.env.get("R2_WORKER_DELIVERY_SECRET");
      const authorization = req.headers.get("Authorization");

      if (!r2WorkerUrl || !deliverySecret || !authorization) {
        return json({ error: "R2 delivery is not configured." }, 500);
      }

      let r2Path = product.pdf_file;

      if (!r2Path.startsWith("products/")) {
        const migrationResponse = await fetch(r2WorkerUrl + "/migrate-legacy", {
          method: "POST",
          headers: {
            Authorization: authorization,
            "X-Delivery-Secret": deliverySecret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: r2Path }),
        });

        const migrationData = await migrationResponse.json().catch(() => ({}));
        if (!migrationResponse.ok || typeof migrationData?.path !== "string" || !migrationData.path.startsWith("products/")) {
          console.error("R2 legacy migration failed:", migrationData);
          return json({ error: typeof migrationData?.error === "string" ? migrationData.error : "Could not move the product PDF to Cloudflare R2." }, 502);
        }

        r2Path = migrationData.path;

        const { error: productUpdateError } = await ctx.supabaseAdmin
          .from("products")
          .update({ pdf_file: r2Path })
          .eq("id", product.id);

        if (productUpdateError) {
          console.error(productUpdateError);
          return json({ error: "The PDF was moved to R2, but the product record could not be updated." }, 500);
        }
      }

      const linkResponse = await fetch(r2WorkerUrl + "/delivery-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Delivery-Secret": deliverySecret,
        },
        body: JSON.stringify({ key: r2Path, expiresIn: 48 * 60 * 60 }),
      });

      const linkData = await linkResponse.json().catch(() => ({}));
      if (!linkResponse.ok || typeof linkData?.url !== "string") {
        console.error("R2 delivery-link failed:", linkData);
        return json({ error: typeof linkData?.error === "string" ? linkData.error : "Could not create the secure R2 download link." }, 502);
      }

      return json({
        ok: true,
        downloadUrl: linkData.url,
        message: "Secure PDF link created.",
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("EDUWALLET_FROM_EMAIL");
    if ((!resendApiKey || !fromEmail) && action !== "verify") {
      return json({ error: "Email delivery is not configured. Add RESEND_API_KEY and EDUWALLET_FROM_EMAIL to Supabase Edge Function secrets." }, 500);
    }

    const r2WorkerUrl = Deno.env.get("R2_WORKER_URL")?.replace(/\/$/, "");
    const deliverySecret = Deno.env.get("R2_WORKER_DELIVERY_SECRET");
    if (!r2WorkerUrl || !deliverySecret) return json({ error: "R2 delivery is not configured." }, 500);

    let r2Path = product.pdf_file;
    if (!r2Path.startsWith("products/")) {
      const authorization = req.headers.get("Authorization");
      if (!authorization) return json({ error: "Your admin session has expired. Please sign in again." }, 401);
      const migrationResponse = await fetch(r2WorkerUrl + "/migrate-legacy", {
        method: "POST",
        headers: {
          Authorization: authorization,
          "X-Delivery-Secret": deliverySecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: r2Path }),
      });
      const migrationData = await migrationResponse.json().catch(() => ({}));
      if (!migrationResponse.ok || typeof migrationData?.path !== "string" || !migrationData.path.startsWith("products/")) {
        return json({ error: typeof migrationData?.error === "string" ? migrationData.error : "Could not migrate the PDF to private Cloudflare R2 storage." }, 502);
      }
      r2Path = migrationData.path;
      const { error: productUpdateError } = await ctx.supabaseAdmin.from("products").update({ pdf_file: r2Path }).eq("id", product.id);
      if (productUpdateError) return json({ error: "The PDF was moved to R2, but its product record could not be updated." }, 500);
    }
    const linkResponse = await fetch(r2WorkerUrl + "/delivery-link", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Delivery-Secret": deliverySecret },
      body: JSON.stringify({ key: r2Path, expiresIn: 48 * 60 * 60 }),
    });
    const linkData = await linkResponse.json().catch(() => ({}));
    if (!linkResponse.ok || typeof linkData?.url !== "string") {
      console.error("R2 delivery-link failed:", linkData);
      return json({ error: typeof linkData?.error === "string" ? linkData.error : "Could not create the secure R2 download link." }, 502);
    }
    const downloadUrl = linkData.url;

    const customerName = escapeHtml(order.full_name || "Customer");
    const productTitle = escapeHtml(product.title || order.product_title);
    const amount = formatInr(Number(order.amount));

    let emailSent = false;
    if (resendApiKey && fromEmail) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
        "Idempotency-Key":
          action === "verify"
            ? `edu-wallet-order-${order.id}-verified`
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
        return json({ error: "Email delivery failed. No successful delivery was recorded; retry after fixing email configuration." }, 502);
      }
      emailSent = true;
    }

    const deliveredAt = new Date().toISOString();

    if (action === "verify") {
      const { data: updatedOrder, error: updateError } = await ctx.supabaseAdmin
        .from("orders")
        .update({
          status: "Payment Verified",
          payment_status: "verified",
          order_status: "delivered",
          verified_at: order.verified_at ?? deliveredAt,
          delivered_at: deliveredAt,
        })
        .eq("id", order.id)
        .eq("product_type", "pdf")
        .neq("payment_status", "rejected")
        .neq("order_status", "cancelled")
        .select("id")
        .maybeSingle();

      if (updateError || !updatedOrder) {
        console.error(updateError);
        return json({ error: "The order could not be marked delivered. Check the order before retrying." }, 500);
      }
    } else {
      const { data: updatedOrder, error: updateError } = await ctx.supabaseAdmin
        .from("orders")
        .update({
          order_status: "delivered",
          delivered_at: deliveredAt,
        })
        .eq("id", order.id)
        .eq("product_type", "pdf")
        .eq("payment_status", "verified")
        .select("id")
        .maybeSingle();

      if (updateError || !updatedOrder) {
        console.error("Delivery status update failed:", updateError);
        return json({ error: "Document sent, but the order delivery status could not be updated." }, 500);
      }
    }

    return json({
      ok: true,
      downloadUrl,
      emailSent,
      message: action === "verify"
        ? (emailSent ? "Payment verified and PDF delivered. A download link is ready for WhatsApp." : "Payment verified and PDF delivered to My Library. A download link is ready for WhatsApp.")
        : (emailSent ? "Document resent successfully." : "Secure PDF link created."),
    });
  }),
};
