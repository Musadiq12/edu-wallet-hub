import { env as workerEnv } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type ReviewStatus = "pending" | "approved" | "rejected";
type ApplicationRow = {
  id: string;
  user_id: string;
  full_name: string;
  profession: string;
  education: string;
  exams: string[] | null;
  id_card_path: string | null;
  upi_id: string;
  status: ReviewStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  user_email?: string | null;
};

function env(name: string) {
  // Cloudflare Worker variables are available as env bindings, while this server
  // bundle may not expose them through process.env on every compatibility setup.
  // Public Supabase settings can safely fall back to Vite's build-time values;
  // the service-role key must remain a runtime secret and has no public fallback.
  const publicFallbacks: Record<string, string | undefined> = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  const value = process.env[name] || workerEnv[name as keyof typeof workerEnv] || publicFallbacks[name];
  if (!value) throw new Error("Server configuration is missing " + name + ".");
  return value;
}

async function requireAdmin(accessToken: string) {
  // The token is supplied by the browser's Supabase session, but is never trusted
  // until Supabase validates its signature and expiry below.
  if (typeof accessToken !== "string" || accessToken.split(".").length !== 3) {
    throw new Error("Please sign in to continue.");
  }

  const url = env("SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(accessToken);
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") throw new Error("Please sign in to continue.");

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    throw new Error("Administrator access required.");
  }

  return adminClient;
}

// This server check is called from the route guard. The service-role client is
// created only after Supabase verifies the caller and their live profiles.role.
export const assertSellerApplicationsAdmin = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string }) => {
    if (!input || typeof input.accessToken !== "string") throw new Error("Please sign in to continue.");
    return input;
  })
  .handler(async ({ data }) => {
    try {
      await requireAdmin(data.accessToken);
      return { authorized: true as const };
    } catch (error) {
      // A verified user with a non-admin profile is denied cleanly. Configuration,
      // token-validation, and database errors still surface for diagnosis.
      if (error instanceof Error && error.message === "Administrator access required.") {
        return { authorized: false as const };
      }
      throw error;
    }
  });

export const listSellerApplications = createServerFn({ method: "POST" })
  .validator((input: { status: ReviewStatus; accessToken: string }) => {
    if (!input || !["pending", "approved", "rejected"].includes(input.status)) {
      throw new Error("Invalid application status.");
    }
    if (typeof input.accessToken !== "string") throw new Error("Please sign in to continue.");
    return input;
  })
  .handler(async ({ data }) => {
    const adminClient = await requireAdmin(data.accessToken);
    const { data: rows, error } = await adminClient
      .from("seller_applications")
      .select("id,user_id,full_name,profession,education,exams,id_card_path,upi_id,status,rejection_reason,created_at,reviewed_at")
      .eq("status", data.status)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load seller applications.");

    const applications = (rows ?? []) as ApplicationRow[];
    if (!applications.length) return [];
    const userIds = [...new Set(applications.map((row) => row.user_id))];
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id,email")
      .in("id", userIds);
    if (profilesError) throw new Error("Could not load applicant contact details.");
    const emailById = new Map((profiles ?? []).map((profile) => [profile.id, profile.email ?? null]));
    return applications.map((row) => ({ ...row, user_email: emailById.get(row.user_id) ?? null }));
  });

export const getSellerApplicationDetail = createServerFn({ method: "POST" })
  .validator((input: { id: string; accessToken: string }) => {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("Invalid application.");
    if (typeof input.accessToken !== "string") throw new Error("Please sign in to continue.");
    return input;
  })
  .handler(async ({ data }) => {
    const adminClient = await requireAdmin(data.accessToken);
    const { data: row, error } = await adminClient
      .from("seller_applications")
      .select("id,user_id,full_name,profession,education,exams,id_card_path,upi_id,status,rejection_reason,created_at,reviewed_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Application not found.");

    const { data: profile } = await adminClient.from("profiles")
      .select("email").eq("id", row.user_id).maybeSingle();
    let idCardUrl: string | null = null;
    if (row.id_card_path) {
      // Service-role signing bypasses Storage RLS, so verify ownership explicitly first.
      if (!row.id_card_path.startsWith(row.user_id + "/")) {
        throw new Error("The ID card path does not belong to this applicant.");
      }
      // A private-bucket URL, valid for 300 seconds; no public URL is ever generated.
      const { data: signed, error: signedError } = await adminClient.storage
        .from("seller-documents")
        .createSignedUrl(row.id_card_path, 300);
      if (signedError) throw new Error("Could not securely open the ID card.");
      idCardUrl = signed.signedUrl;
    }
    return { ...(row as ApplicationRow), user_email: profile?.email ?? null, id_card_url: idCardUrl };
  });

export const approveSellerApplication = createServerFn({ method: "POST" })
  .validator((input: { id: string; accessToken: string }) => {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("Invalid application.");
    if (typeof input.accessToken !== "string") throw new Error("Please sign in to continue.");
    return input;
  })
  .handler(async ({ data }) => {
    const adminClient = await requireAdmin(data.accessToken);
    const { data: row, error: rowError } = await adminClient
      .from("seller_applications")
      .select("id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (rowError || !row) throw new Error("Application not found.");
    if (row.status !== "pending") throw new Error("Only pending applications can be approved.");

    // This database function atomically updates the application and profile role.
    const { error } = await adminClient.rpc("server_review_seller_application", {
      p_application_id: data.id,
      p_status: "approved",
      p_rejection_reason: null,
    });
    if (error) throw new Error("Could not approve this application. It may already have been reviewed.");
    return { ok: true };
  });

export const rejectSellerApplication = createServerFn({ method: "POST" })
  .validator((input: { id: string; reason: string; accessToken: string }) => {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("Invalid application.");
    if (typeof input.accessToken !== "string") throw new Error("Please sign in to continue.");
    if (typeof input.reason !== "string" || input.reason.trim().length < 3 || input.reason.trim().length > 1000) {
      throw new Error("Enter a rejection reason between 3 and 1000 characters.");
    }
    return { id: input.id, reason: input.reason.trim(), accessToken: input.accessToken };
  })
  .handler(async ({ data }) => {
    const adminClient = await requireAdmin(data.accessToken);
    const { error } = await adminClient.rpc("server_review_seller_application", {
      p_application_id: data.id,
      p_status: "rejected",
      p_rejection_reason: data.reason,
    });
    if (error) throw new Error("Could not reject this application. It may already have been reviewed.");
    return { ok: true };
  });

export const getPendingSellerApplicationCount = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string }) => {
    if (!input || typeof input.accessToken !== "string") throw new Error("Please sign in to continue.");
    return input;
  })
  .handler(async ({ data }) => {
    const adminClient = await requireAdmin(data.accessToken);
    const { count, error } = await adminClient
      .from("seller_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) throw new Error("Could not load pending application count.");
    return count ?? 0;
  });
