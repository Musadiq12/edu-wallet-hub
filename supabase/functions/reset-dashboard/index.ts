import { withSupabase } from "npm:@supabase/server";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ResetBody = { password?: unknown; confirmText?: unknown };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requestIp(request: Request): string | null {
  const candidate = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null;
  if (!candidate || candidate.length > 45) return null;
  // Avoid accepting arbitrary text as an inet value; PostgreSQL validates again.
  return /^[0-9a-fA-F:.]+$/.test(candidate) ? candidate : null;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

    const { data: authData, error: authError } = await ctx.supabase.auth.getUser();
    const actorId = authData.user?.id;
    if (authError || !actorId) return json({ error: "Authentication required." }, 403);

    const { data: isAdmin, error: roleError } = await ctx.supabase.rpc("has_role", {
      _user_id: actorId,
      _role: "admin",
    });
    if (roleError || isAdmin !== true) return json({ error: "Reset is not permitted." }, 403);

    let body: ResetBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    if (
      typeof body.password !== "string" ||
      body.password.length < 12 ||
      body.password.length > 1024 ||
      typeof body.confirmText !== "string" ||
      body.confirmText !== "DELETE"
    ) {
      return json({ error: "Enter a reset password of at least 12 characters and type DELETE exactly." }, 400);
    }

    const resetHash = Deno.env.get("RESET_PASSWORD_HASH");
    if (!resetHash || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(resetHash)) {
      console.error("RESET_PASSWORD_HASH is missing or is not a bcrypt hash.");
      return json({ error: "Dashboard reset is not configured. Contact the system administrator." }, 500);
    }

    const ip = requestIp(req);
    const { data: allowed, error: rateError } = await ctx.supabaseAdmin.rpc("admin_reset_guard", {
      p_actor_id: actorId,
      p_ip_address: ip,
    });
    if (rateError) {
      console.error("Reset rate-limit check failed:", rateError);
      return json({ error: "Could not validate reset request. Please try again." }, 500);
    }
    if (allowed !== true) return json({ error: "Too many reset attempts. Try again in 15 minutes." }, 429);

    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(body.password, resetHash);
    } catch (error) {
      console.error("Reset password comparison failed:", error);
      return json({ error: "Dashboard reset is not configured correctly." }, 500);
    }

    if (!passwordMatches) {
      const { error: auditError } = await ctx.supabaseAdmin.from("admin_activity_logs").insert({
        actor_id: actorId,
        action: "reset_dashboard_wrong_password",
        entity_type: "sales_data",
        before_data: { result: "denied" },
        after_data: { result: "wrong_password" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent")?.slice(0, 1000) ?? null,
      });
      if (auditError) {
        console.error("Failed to record rejected reset attempt:", auditError);
        return json({ error: "Could not record the reset attempt. Please try again." }, 500);
      }
      return json({ error: "Reset password is incorrect." }, 401);
    }

    const { data: resetResult, error: resetError } = await ctx.supabaseAdmin.rpc("admin_reset_dashboard", {
      p_actor_id: actorId,
      p_ip_address: ip,
      p_user_agent: req.headers.get("user-agent")?.slice(0, 1000) ?? null,
    });
    if (resetError || resetResult?.ok !== true) {
      console.error("Dashboard reset transaction failed:", resetError);
      return json({ error: "Reset failed. No sales data was deleted; please try again." }, 500);
    }

    return json({ ok: true, message: "Dashboard reset successfully." });
  }),
};
