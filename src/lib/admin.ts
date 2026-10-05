import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/catalog";

export const BUCKETS = {
  cover: "product-covers",
  preview: "product-previews",
  file: "product-files",
  proof: "payment-proofs",
} as const;

export const LIMITS = {
  coverBytes: 5 * 1024 * 1024,
  previewBytes: 20 * 1024 * 1024,
  fileBytes: 50 * 1024 * 1024,
};

export function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Friendly message for any backend failure — never surfaces raw database text. */
export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw = typeof err === "string" ? err : ((err as { message?: string })?.message ?? "");
  const m = raw.toLowerCase();
  if (m.includes("duplicate key") && m.includes("slug")) return "That slug is already used by another product. Choose a different one.";
  if (m.includes("duplicate key")) return "This record already exists.";
  if (m.includes("administrator access required") || m.includes("admin access required")) return "Your current account is not an administrator. Log in with the EduWallet admin account.";
  if (m.includes("exceeded the maximum allowed size") || m.includes("payload too large")) return "That file is too large for this upload.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Network problem. Check your connection and try again.";
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("already registered")) return "An account with that email already exists.";
  return fallback;
}

export type UploadResult = { path: string };

const R2_WORKER_URL = (import.meta.env["VITE_R2_WORKER_URL"] || "https://edu-wallet-r2.designeroutletmedia.workers.dev").replace(/\/$/, "");

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your admin session has expired. Please sign in again.");
  return token;
}

export async function uploadFile(bucket: string, file: File, folder: string): Promise<UploadResult> {
  if (bucket === BUCKETS.file && R2_WORKER_URL) {
    if (file.type !== "application/pdf") throw new Error("Only PDF files are allowed.");
    if (file.size > LIMITS.fileBytes) throw new Error("That PDF is larger than 50 MB.");

    const token = await getAccessToken();
    const response = await fetch(
      `${R2_WORKER_URL}/upload?filename=${encodeURIComponent(file.name)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/pdf",
        },
        body: file,
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "R2 upload failed.");
    }
    if (typeof data?.path !== "string" || !data.path.startsWith("products/")) {
      throw new Error("R2 upload did not return a valid product file path.");
    }
    return { path: data.path };
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream"
  });
  if (error) throw error;
  return { path };
}

export async function removeFile(bucket: string, path: string | null | undefined) {
  if (!path) return;

  if (bucket === BUCKETS.file && R2_WORKER_URL && path.startsWith("products/")) {
    const token = await getAccessToken();
    const response = await fetch(
      `${R2_WORKER_URL}/delete?key=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) return;
    return;
  }

  await supabase.storage.from(bucket).remove([path]);
}
export const ADMIN_PRODUCT_FIELDS =
  "id,title,slug,description,whats_included,category_id,course_label,subject_label,keywords,price,discounted_price,cover_image,pdf_file,preview_file,page_count,format,is_free,is_featured,is_active,is_demo,is_archived,created_at";

export type AdminProduct = Product & { is_archived: boolean };

export const adminProductsQuery = (includeArchived = false) =>
  queryOptions({
    queryKey: ["admin", "products", includeArchived],
    queryFn: async (): Promise<AdminProduct[]> => {
      let q = supabase.from("products").select(ADMIN_PRODUCT_FIELDS).order("created_at", { ascending: false });
      if (!includeArchived) q = q.eq("is_archived", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdminProduct[];
    },
  });

export const adminProductQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "product", id],
    queryFn: async (): Promise<AdminProduct | null> => {
      const { data, error } = await supabase
        .from("products")
        .select(ADMIN_PRODUCT_FIELDS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as AdminProduct | null;
    },
  });

export type AdminOrder = {
  id: string;
  user_id: string;
  product_id: string | null;
  product_title: string;
  full_name: string;
  email: string;
  whatsapp: string;
  amount: number | string;
  payment_method: string;
  transaction_id: string | null;
  screenshot_path: string | null;
  payment_status: string;
  order_status: string;
  admin_note: string | null;
  created_at: string;
  verified_at: string | null;
  delivered_at: string | null;
};

export const adminOrdersQuery = () =>
  queryOptions({
    queryKey: ["admin", "orders"],
    queryFn: async (): Promise<AdminOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,user_id,product_id,product_title,full_name,email,whatsapp,amount,payment_method,transaction_id,screenshot_path,payment_status,order_status,admin_note,created_at,verified_at,delivered_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminOrder[];
    },
  });

export type AdminCustomer = {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp: string | null;
  created_at: string;
};

export const adminCustomersQuery = () =>
  queryOptions({
    queryKey: ["admin", "customers"],
    queryFn: async (): Promise<AdminCustomer[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,whatsapp,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminCustomer[];
    },
  });


export type AdminContactMessage = {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  message: string;
  created_at: string;
};

export const adminContactMessagesQuery = () =>
  queryOptions({
    queryKey: ["admin", "contact-messages"],
    queryFn: async (): Promise<AdminContactMessage[]> => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("id,name,email,whatsapp,message,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminContactMessage[];
    },
  });

export async function deleteContactMessage(id: string) {
  const { error } = await supabase.from("contact_messages").delete().eq("id", id);
  if (error) throw error;
}
