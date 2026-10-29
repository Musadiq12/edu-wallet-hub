import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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
  const value = process.env[name];
  if (!value) throw new Error(`Server configuration is missing ${name}.`);
  return value;
}

async function requireAdmin() {
  const authorization = getRequest()?.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!bearer || bearer.split(".").length !== 3) throw new Error("Admin access required.");

  const url = env("SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(bearer);
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") throw new Error("Please sign in to continue.");

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profileError || profile?.role !== "admin") throw new Error("Administrator access required.");

  return { adminClient, userId };
}

export const listSellerApplications = createServerFn({ method: "GET" })
  .validator((input: { status: ReviewStatus }) => {
    if (!input || !["pending", "approved", "rejected"].includes(input.status)) throw new Error("Invalid application status.");
    return input;
  })
  .handler(async ({ data }) => {
    const { adminClient } = await requireAdmin();
    const { data: rows, error } = await adminClient
      .from("seller_applications")
      .select("id,user_id,full_name,profession,education,exams,id_card_path,upi_id,status,rejection_reason,created_at,reviewed_at")
      .eq("status", data.status)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load seller applications.");
    const applications = (rows ?? []) as ApplicationRow[];
    if (!applications.length) return [];
    const userIds = [...new Set(applications.map((row) => row.user_id))];
    const { data: users } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const emailById = new Map((users?.users ?? []).map((user) => [user.id, user.email ?? null]));
    return applications.map((row) => ({ ...row, user_email: emailById.get(row.user_id) ?? null }));
  });

export const getSellerApplicationDetail = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("Invalid application.");
    return input;
  })
  .handler(async ({ data }) => {
    const { adminClient } = await requireAdmin();
    const { data: row, error } = await adminClient
      .from("seller_applications")
      .select("id,user_id,full_name,profession,education,exams,id_card_path,upi_id,status,rejection_reason,created_at,reviewed_at")
      .eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Application not found.");
    const { data: userData } = await adminClient.auth.admin.getUserById(row.user_id);
    let idCardUrl: string | null = null;
    if (row.id_card_path) {
      const { data: signed, error: signedError } = await adminClient.storage
        .from("seller-documents").createSignedUrl(row.id_card_path, 300);
      if (signedError) throw new Error("Could not securely open the ID card.");
      idCardUrl = signed.signedUrl;
    }
    return { ...(row as ApplicationRow), user_email: userData.user?.email ?? null, id_card_url: idCardUrl };
  });

export const approveSellerApplication = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("Invalid application.");
    return input;
  })
  .handler(async ({ data }) => {
    const { adminClient } = await requireAdmin();
    const { data: row, error: rowError } = await adminClient.from("seller_applications")
      .select("id,status").eq("id", data.id).maybeSingle();
    if (rowError || !row) throw new Error("Application not found.");
    if (row.status !== "pending") throw new Error("Only pending applications can be approved.");
    const { error } = await adminClient.rpc("admin_review_seller_application", {
      p_application_id: data.id,
      p_status: "approved",
      p_rejection_reason: null,
    });
    if (error) throw new Error("Could not approve this application. It may already have been reviewed.");
    return { ok: true };
  });

export const rejectSellerApplication = createServerFn({ method: "POST" })
  .validator((input: { id: string; reason: string }) => {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("Invalid application.");
    if (typeof input.reason !== "string" || input.reason.trim().length < 3 || input.reason.trim().length > 1000) {
      throw new Error("Enter a rejection reason between 3 and 1000 characters.");
    }
    return { id: input.id, reason: input.reason.trim() };
  })
  .handler(async ({ data }) => {
    const { adminClient } = await requireAdmin();
    const { error } = await adminClient.rpc("admin_review_seller_application", {
      p_application_id: data.id,
      p_status: "rejected",
      p_rejection_reason: data.reason,
    });
    if (error) throw new Error("Could not reject this application. It may already have been reviewed.");
    return { ok: true };
  });

export const getPendingSellerApplicationCount = createServerFn({ method: "GET" })
  .handler(async () => {
    const { adminClient } = await requireAdmin();
    const { count, error } = await adminClient.from("seller_applications")
      .select("id", { count: "exact", head: true }).eq("status", "pending");
    if (error) throw new Error("Could not load pending application count.");
    return count ?? 0;
  });
