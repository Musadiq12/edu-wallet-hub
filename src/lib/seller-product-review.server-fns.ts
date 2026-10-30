import { env as workerEnv } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function env(name: string) {
  const fallbacks: Record<string, string | undefined> = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  const value = process.env[name] || workerEnv[name as keyof typeof workerEnv] || fallbacks[name];
  if (!value) throw new Error("Server configuration is missing " + name + ".");
  return value;
}

async function requireAdmin(accessToken: string) {
  if (typeof accessToken !== "string" || accessToken.split(".").length !== 3) {
    throw new Error("Please sign in to continue.");
  }
  const url = env("SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getClaims(accessToken);
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !z.string().uuid().safeParse(userId).success) {
    throw new Error("Please sign in to continue.");
  }
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: adminUser, error: adminUserError }, { data: adminRole, error: adminRoleError }] = await Promise.all([
    adminClient.from("admin_users").select("user_id").eq("user_id", userId).eq("is_active", true).maybeSingle(),
    adminClient.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  if (adminUserError || adminRoleError || (!adminUser && !adminRole)) {
    throw new Error("Administrator access required.");
  }
  return adminClient;
}

const idSchema = z.string().uuid();
const feedbackSchema = z.string().trim().min(10).max(1000);

export const listSellerProductReviews = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;status?:string})=>{
    return {
      accessToken:z.string().min(1).parse(input.accessToken),
      status:z.enum(["pending","published","rejected","unpublished","all"]).parse(input.status ?? "pending"),
    };
  })
  .handler(async({data})=>{
    const admin=await requireAdmin(data.accessToken);
    let query=admin.from("products").select("id,title,slug,description,whats_included,course_label,subject_label,price,pdf_file,preview_file,cover_image,page_count,format,is_active,is_archived,status,review_feedback,rejection_reason,admin_notes,submitted_at,reviewed_at,published_at,revision_of,seller_id,created_at,category_id")
      .not("seller_id","is",null).is("deleted_at",null).order("submitted_at",{ascending:true,nullsFirst:true});
    if(data.status!=="all") query=query.eq("status",data.status);
    const {data:rows,error}=await query;
    if(error) throw new Error("Could not load seller product reviews.");
    return rows ?? [];
  });

export const getSellerProductReview = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;id:string})=>({
    accessToken:z.string().min(1).parse(input.accessToken),
    id:idSchema.parse(input.id),
  }))
  .handler(async({data})=>{
    const admin=await requireAdmin(data.accessToken);
    const {data:product,error}=await admin.from("products")
      .select("id,title,slug,description,whats_included,course_label,subject_label,price,pdf_file,preview_file,cover_image,page_count,format,is_active,is_archived,status,review_feedback,rejection_reason,admin_notes,submitted_at,reviewed_at,published_at,revision_of,seller_id,created_at,category_id")
      .eq("id",data.id).not("seller_id","is",null).is("deleted_at",null).maybeSingle();
    if(error || !product) throw new Error("Seller product not found.");
    const paths=[product.pdf_file,product.preview_file].filter((path):path is string=>typeof path==="string");
    for(const path of paths){
      if(!path.startsWith(product.seller_id + "/")) throw new Error("Seller file ownership check failed.");
    }
    const [main,preview]=await Promise.all([
      product.pdf_file ? admin.storage.from("product-files").createSignedUrl(product.pdf_file,300) : Promise.resolve({data:null,error:null}),
      product.preview_file ? admin.storage.from("product-files").createSignedUrl(product.preview_file,300) : Promise.resolve({data:null,error:null}),
    ]);
    if(main.error || preview.error) throw new Error("Could not securely preview the seller PDF.");
    const [{data:profile},{count:totalProducts},{count:rejectedProducts}]=await Promise.all([
      admin.from("profiles").select("full_name,email,created_at").eq("id",product.seller_id).maybeSingle(),
      admin.from("products").select("id",{count:"exact",head:true}).eq("seller_id",product.seller_id).is("deleted_at",null),
      admin.from("products").select("id",{count:"exact",head:true}).eq("seller_id",product.seller_id).eq("status","rejected").is("deleted_at",null),
    ]);
    return {
      ...product,
      seller_name:profile?.full_name ?? "Seller",
      seller_email:profile?.email ?? null,
      seller_joined_at:profile?.created_at ?? null,
      seller_total_products:totalProducts ?? 0,
      seller_rejected_products:rejectedProducts ?? 0,
      pdf_url:main.data?.signedUrl ?? null,
      preview_url:preview.data?.signedUrl ?? null,
    };
  });

export const reviewSellerProduct = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;id:string;action:"approve"|"reject"|"unpublish"|"republish"|"save_notes";reason?:string|null;adminNotes?:string|null})=>{
    const action=z.enum(["approve","reject","unpublish","republish","save_notes"]).parse(input.action);
    return {
      accessToken:z.string().min(1).parse(input.accessToken),
      id:idSchema.parse(input.id),
      action,
      reason:action==="reject"?feedbackSchema.parse(input.reason):null,
      adminNotes:action==="save_notes"?z.string().max(4000).parse(input.adminNotes??""):null,
    };
  })
  .handler(async({data})=>{
    const admin=await requireAdmin(data.accessToken);
    const {data:updated,error}=await admin.rpc("transition_seller_product",{
      p_product_id:data.id,p_action:data.action,p_reason:data.reason,p_admin_notes:data.adminNotes,
    });
    if(error || !updated) throw new Error("Could not update the seller product review. Refresh and try again.");
    return {ok:true,status:updated.status};
  });
