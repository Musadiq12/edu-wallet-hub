import { env as workerEnv } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function env(name: string) {
  const publicFallbacks: Record<string, string | undefined> = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  const value = process.env[name] || workerEnv[name as keyof typeof workerEnv] || publicFallbacks[name];
  if (!value) throw new Error("Server configuration is missing " + name + ".");
  return value;
}

const productIdSchema = z.string().uuid();
const productInputSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(2000),
  whatsIncluded: z.string().trim().min(5).max(2000),
  categoryId: z.string().uuid().nullable(),
  pageCount: z.number().int().min(1).max(99999),
  coverSourceUrl: z.string().trim().max(2048).nullable(),
  rightsConfirmed: z.literal(true),
  exam: z.enum(["NEET","JEE","UPSC","SSC","CGL","CLAT","CA","Other"]),
  subject: z.string().trim().min(2).max(60),
  price: z.number().finite().min(10).max(5000).refine(v => Math.round(v*100) === v*100),
  pdfPath: z.string().min(1).max(500),
  previewPath: z.string().max(500).nullable().optional(),
});

function validateCoverSourceUrl(value: string | null) {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid Google Drive share link."); }
  const match = url.hostname === "drive.google.com"
    ? (url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{10,})(?:\/view)?\/?$/)?.[1] ?? url.searchParams.get("id"))
    : null;
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.port || url.username || url.password
      || !match || !/^[A-Za-z0-9_-]{10,}$/.test(match)) {
    throw new Error("Use a valid Google Drive file link, not a product PDF link.");
  }
  return { source: url.toString(), preview: `https://drive.google.com/file/d/${match}/preview` };
}
const listStatusSchema = z.enum(["pending","published","rejected","unpublished","all"]);
const pageSchema = z.number().int().min(1).max(100000);
const salesLimitSchema = z.number().int().min(1).max(20);

type SellerContext = { userId: string; client: ReturnType<typeof createClient> };

async function requireSeller(accessToken: string): Promise<SellerContext> {
  if (typeof accessToken !== "string" || accessToken.split(".").length !== 3) {
    throw new Error("Please sign in to continue.");
  }
  const client = createClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getClaims(accessToken);
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !z.string().uuid().safeParse(userId).success) {
    throw new Error("Please sign in to continue.");
  }
  const { data: profile, error: profileError } = await client
    .from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profileError || profile?.role !== "seller") {
    throw new Error("Seller access is no longer available for this account.");
  }
  return { userId, client };
}

function safeMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("product not found")) return "This product could not be found.";
  if (message.includes("duplicate key")) return "That product URL is already in use. Please change the title.";
  if (message.includes("invalid product") || message.includes("22023")) return "Check the product details and try again.";
  if (message.includes("archived")) return "Archived products cannot be edited.";
  if (message.includes("seller access")) return "Seller access is no longer available. Please sign in again.";
  return fallback;
}

function safeFilenamePart(name: string) {
  const withoutExtension = name.replace(/\.pdf$/i, "");
  const cleaned = withoutExtension.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "study-note").slice(0, 80);
}

async function makePrivatePdfPath(context: SellerContext, originalName: string) {
  const folderId = crypto.randomUUID();
  const fileName = crypto.randomUUID() + "_" + safeFilenamePart(originalName) + ".pdf";
  return context.userId + "/" + folderId + "/" + fileName;
}

async function verifyStoredPdf(context: SellerContext, path: string, maxBytes: number) {
  if (!path.startsWith(context.userId + "/") || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}_[A-Za-z0-9_-]+\.pdf$/i.test(path.slice(context.userId.length + 1))) {
    throw new Error("Invalid private PDF path.");
  }
  const { data: object, error: objectError } = await context.client.storage.from("product-files").list(path.split("/").slice(0,2).join("/"), {
    search: path.split("/").pop(), limit: 1,
  });
  const found = object?.find(item => item.name === path.split("/").pop());
  if (objectError || !found || found.metadata?.mimetype !== "application/pdf" || Number(found.metadata?.size ?? 0) > maxBytes) {
    throw new Error("Upload a valid PDF within the allowed size limit.");
  }
  const { data: file, error } = await context.client.storage.from("product-files").download(path);
  if (error || !file || file.size < 5 || file.size > maxBytes || file.type !== "application/pdf") {
    throw new Error("Upload a valid PDF within the allowed size limit.");
  }
  const header = new Uint8Array(await file.slice(0,5).arrayBuffer());
  if (header[0] !== 0x25 || header[1] !== 0x50 || header[2] !== 0x44 || header[3] !== 0x46 || header[4] !== 0x2d) {
    throw new Error("The uploaded file is not a valid PDF.");
  }
}

async function removePrivateFiles(context: SellerContext, paths: Array<string | null | undefined>) {
  const ownPaths = [...new Set(paths.filter((p): p is string =>
    typeof p === "string" && p.startsWith(context.userId + "/")))];
  if (ownPaths.length) await context.client.storage.from("product-files").remove(ownPaths);
}

export const sellerDashboardData = createServerFn({ method: "POST" })
  .validator((input: { accessToken: string }) => {
    if (!input || typeof input.accessToken !== "string") throw new Error("Please sign in.");
    return input;
  })
  .handler(async ({ data }) => {
    try {
      const { userId, client } = await requireSeller(data.accessToken);
      // Read the orders table directly, scoped to the authenticated seller.
      // This avoids relying on the seller_sales view's owner/security-invoker behavior.
      const [{ count, error: countError }, { data: earnedRows, error: earnedError }, { data: recent, error: recentError }, { data: balance, error: balanceError }] = await Promise.all([
        client.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("refunded", false).not("seller_share", "is", null),
        client.from("orders").select("seller_share").eq("seller_id", userId).eq("refunded", false).not("seller_share", "is", null),
        client.from("seller_sales").select("id,created_at,product_title,seller_share,commission_amount,commission_rate,available_on,refunded")
          .order("created_at", { ascending: false }).limit(5),
        client.rpc("seller_balance", { p_seller_id: userId }),
      ]);
      if (countError || earnedError || recentError || balanceError) throw new Error("Unable to load seller summary.");
      const orders = recent ?? [];
      const totalEarned = (earnedRows ?? []).reduce((sum,row)=>sum+Number(row.seller_share??0),0);
      const [{ data: walletSummary, error: walletSummaryError }] = await Promise.all([
        client.rpc("seller_wallet_summary"),
      ]);
      if (walletSummaryError) throw new Error("Unable to load seller wallet summary.");
      const wallet = (walletSummary ?? {}) as { withdrawable_balance?: number; commission_deducted?: number };
      const totals = (Array.isArray(balance) ? balance[0] : balance) as {pending_balance?:number;available_balance?:number} | null;
      return {
        totalSales: count ?? 0,
        totalEarned,
        pendingBalance: Number(totals?.pending_balance ?? 0),
        availableBalance: Number(wallet.withdrawable_balance ?? totals?.available_balance ?? 0),
        commissionDeducted: Number(wallet.commission_deducted ?? 0),
        recent: orders.map(row => ({
          id: row.id, created_at: row.created_at, product_title: row.product_title,
          seller_share: Number(row.seller_share ?? 0), refunded: row.refunded,
          commission_amount: Number(row.commission_amount ?? 0), commission_rate: Number(row.commission_rate ?? 0),
          available_on: row.available_on,
        })),
      };
    } catch (error) {
      throw new Error(safeMessage(error, "Unable to load your seller dashboard."));
    }
  });

export const sellerListProducts = createServerFn({ method: "POST" })
  .validator((input: { accessToken:string; status?:string }) => {
    if (!input || typeof input.accessToken!=="string") throw new Error("Please sign in.");
    return { accessToken:input.accessToken,status:listStatusSchema.parse(input.status ?? "all") };
  })
  .handler(async ({data}) => {
    try {
      const {userId,client}=await requireSeller(data.accessToken);
      let query=client.from("products").select("id,title,slug,course_label,subject_label,price,description,pdf_file,preview_file,status,is_archived,is_active,review_feedback,rejection_reason,submitted_at,published_at,revision_of,created_at")
        .eq("seller_id",userId).is("deleted_at",null).order("submitted_at",{ascending:false,nullsFirst:false});
      if(data.status!=="all") query=query.eq("status",data.status);
      const {data:rows,error}=await query;
      if(error) throw error;
      return rows ?? [];
    } catch(error) { throw new Error(safeMessage(error,"Could not load your products.")); }
  });

export const sellerGetProduct = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;id:string})=>({
    accessToken:z.string().min(1).parse(input.accessToken),
    id:productIdSchema.parse(input.id),
  }))
  .handler(async({data})=>{
    try {
      const {userId,client}=await requireSeller(data.accessToken);
      const {data:row,error}=await client.from("products")
        .select("id,title,slug,description,whats_included,category_id,page_count,seller_cover_source_url,seller_rights_confirmed_at,course_label,subject_label,price,pdf_file,preview_file,status,is_archived,is_active,created_at,rejection_reason,review_feedback")
        .eq("id",data.id).eq("seller_id",userId).is("deleted_at",null).maybeSingle();
      if(error || !row) throw new Error("product not found");
      return row;
    } catch(error) { throw new Error(safeMessage(error,"Could not load this product.")); }
  });

export const sellerCreateProduct = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;title:string;description:string;whatsIncluded:string;categoryId:string|null;pageCount:number;coverSourceUrl:string|null;rightsConfirmed:true;exam:string;subject:string;price:number;pdfPath:string;previewPath?:string|null}) => {
    const parsed=productInputSchema.parse(input);
    const cover=validateCoverSourceUrl(parsed.coverSourceUrl);
    return { ...parsed, cover, accessToken:z.string().min(1).parse(input.accessToken) };
  })
  .handler(async({data})=>{
    const context=await requireSeller(data.accessToken);
    await verifyStoredPdf(context,data.pdfPath,20*1024*1024);
    if(data.previewPath) await verifyStoredPdf(context,data.previewPath,5*1024*1024);
    const slug=data.title.toLowerCase().trim().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)+"-"+crypto.randomUUID().slice(0,8);
    const {data:id,error}=await context.client.rpc("seller_create_product",{
      p_title:data.title,p_slug:slug,p_description:data.description,p_exam_label:data.exam,
      p_subject_label:data.subject,p_price:data.price,p_pdf_path:data.pdfPath,p_preview_path:data.previewPath??null,
      p_whats_included:data.whatsIncluded,p_category_id:data.categoryId,p_page_count:data.pageCount,
      p_seller_cover_source_url:data.cover?.source??null,p_rights_confirmed:data.rightsConfirmed,
    });
    if(error){
      await removePrivateFiles(context,[data.pdfPath,data.previewPath]);
      throw new Error(safeMessage(error,"Could not save your product. Please try again."));
    }
    return {id};
  });

export const sellerCreatePrivateUploadPath = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;originalName:string;kind:"pdf"|"preview"})=>{
    if(!input || typeof input.accessToken!=="string" || typeof input.originalName!=="string" || !["pdf","preview"].includes(input.kind) || !input.originalName.toLowerCase().endsWith(".pdf")) {
      throw new Error("Choose a PDF file.");
    }
    return {accessToken:input.accessToken,originalName:input.originalName,kind:input.kind};
  })
  .handler(async({data})=>{
    const context=await requireSeller(data.accessToken);
    return {path:await makePrivatePdfPath(context,data.originalName)};
  });

export const sellerDeleteProduct = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;id:string})=>({accessToken:z.string().min(1).parse(input.accessToken),id:productIdSchema.parse(input.id)}))
  .handler(async({data})=>{
    const context=await requireSeller(data.accessToken);
    const {data:row,error}=await context.client.from("products").select("pdf_file,preview_file,status")
      .eq("id",data.id).eq("seller_id",context.userId).is("deleted_at",null).maybeSingle();
    if(error || !row) throw new Error("This product could not be found.");
    if(!["pending","rejected"].includes(row.status)) {
      throw new Error("Only pending or rejected products can be deleted. Published products must be taken down by an administrator.");
    }
    const {data:result,error:rpcError}=await context.client.rpc("seller_archive_or_delete_product",{p_product_id:data.id});
    if(rpcError) throw new Error(safeMessage(rpcError,"Could not remove this product."));
    if(result==="deleted") await removePrivateFiles(context,[row.pdf_file,row.preview_file]);
    return {result};
  });

export const sellerSaveProductEdit = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;id:string;title:string;description:string;whatsIncluded:string;categoryId:string|null;pageCount:number;coverSourceUrl:string|null;rightsConfirmed:true;exam:string;subject:string;price:number;pdfPath:string;previewPath?:string|null})=>{
    const parsed=productInputSchema.parse(input);
    const cover=validateCoverSourceUrl(parsed.coverSourceUrl);
    return {...parsed,cover,accessToken:z.string().min(1).parse(input.accessToken),id:productIdSchema.parse(input.id)};
  })
  .handler(async({data})=>{
    const context=await requireSeller(data.accessToken);
    const {data:existing,error:readError}=await context.client.from("products").select("pdf_file,preview_file,status")
      .eq("id",data.id).eq("seller_id",context.userId).is("deleted_at",null).maybeSingle();
    if(readError||!existing) throw new Error("This product could not be found.");
    await verifyStoredPdf(context,data.pdfPath,20*1024*1024);
    if(data.previewPath) await verifyStoredPdf(context,data.previewPath,5*1024*1024);
    const {data:hasOrders,error}=await context.client.rpc("seller_update_product",{
      p_product_id:data.id,p_title:data.title,
      p_slug:data.title.toLowerCase().trim().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)+"-"+crypto.randomUUID().slice(0,8),
      p_description:data.description,p_exam_label:data.exam,p_subject_label:data.subject,p_price:data.price,
      p_pdf_path:data.pdfPath,p_preview_path:data.previewPath??null,
      p_whats_included:data.whatsIncluded,p_category_id:data.categoryId,p_page_count:data.pageCount,
      p_seller_cover_source_url:data.cover?.source??null,p_rights_confirmed:data.rightsConfirmed,
    });
    if(error){
      await removePrivateFiles(context,[data.pdfPath!==existing.pdf_file?data.pdfPath:null,data.previewPath!==existing.preview_file?data.previewPath:null]);
      throw new Error(safeMessage(error,"Could not update this product."));
    }
    if(!hasOrders&&existing.status!=="approved"&&existing.status!=="published") await removePrivateFiles(context,[data.pdfPath!==existing.pdf_file?existing.pdf_file:null,data.previewPath!==existing.preview_file?existing.preview_file:null]);
    return {ok:true,hasOrders};
  });

export const sellerNotifications = createServerFn({method:"POST"})
  .validator((input:{accessToken:string})=>({accessToken:z.string().min(1).parse(input.accessToken)}))
  .handler(async({data})=>{
    const {userId,client}=await requireSeller(data.accessToken);
    const {data:rows,error}=await client.from("seller_notifications")
      .select("id,product_id,event_type,title,message,target_url,read_at,created_at")
      .eq("seller_id",userId).order("created_at",{ascending:false}).limit(30);
    if(error) throw new Error("Could not load seller notifications.");
    return rows??[];
  });

export const markSellerNotificationRead = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;id:string})=>({
    accessToken:z.string().min(1).parse(input.accessToken),id:productIdSchema.parse(input.id),
  }))
  .handler(async({data})=>{
    const {userId,client}=await requireSeller(data.accessToken);
    const {error}=await client.from("seller_notifications").update({read_at:new Date().toISOString()})
      .eq("id",data.id).eq("seller_id",userId);
    if(error) throw new Error("Could not update notification.");
    return {ok:true};
  });


const walletWithdrawalAmountSchema=z.number().finite().positive().max(1000000)
  .refine(value=>Math.round(value*100)===value*100,"Amount must have at most two decimal places.");
const walletUpiSchema=z.string().trim().min(5).max(100)
  .regex(/^[A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]{1,63}$/,"Enter a valid UPI ID.");

export const sellerWalletData=createServerFn({method:"POST"})
 .validator((input:{accessToken:string})=>({accessToken:z.string().min(1).parse(input.accessToken)}))
 .handler(async({data})=>{
  const {client}=await requireSeller(data.accessToken);
  const [{data:summary,error:summaryError},{data:withdrawals,error:historyError},{data:upi,error:upiError}]=await Promise.all([
   client.rpc("seller_wallet_summary"),client.rpc("seller_withdrawal_history"),client.rpc("seller_wallet_upi"),
  ]);
  if(summaryError||historyError||upiError)throw new Error("Could not load your wallet information.");
  return {
   summary:(summary??{}) as {lifetime_earnings:number;commission_deducted:number;pending_balance:number;released_earnings:number;pending_withdrawals:number;withdrawable_balance:number},
   withdrawals:(Array.isArray(withdrawals)?withdrawals:[]) as Array<{id:string;amount:number;status:string;upi_id:string|null;requested_at:string;processing_at:string|null;paid_at:string|null;rejected_at:string|null;rejection_reason:string|null;upi_reference:string|null}>,
   upiId:typeof upi==="string"?upi:"",
  };
 });

export const sellerUpdateWalletUpi=createServerFn({method:"POST"})
 .validator((input:{accessToken:string;upiId:string})=>({accessToken:z.string().min(1).parse(input.accessToken),upiId:walletUpiSchema.parse(input.upiId).toLowerCase()}))
 .handler(async({data})=>{
  const {client}=await requireSeller(data.accessToken);
  const {error}=await client.rpc("seller_update_upi",{p_upi_id:data.upiId});
  if(error)throw new Error(error.message||"Could not update your UPI ID.");
  return {ok:true};
 });

export const sellerRequestWalletWithdrawal=createServerFn({method:"POST"})
 .validator((input:{accessToken:string;amount:number;idempotencyKey:string})=>({
  accessToken:z.string().min(1).parse(input.accessToken),
  amount:walletWithdrawalAmountSchema.parse(input.amount),
  idempotencyKey:z.string().uuid().parse(input.idempotencyKey),
 }))
 .handler(async({data})=>{
  const {client}=await requireSeller(data.accessToken);
  const {data:requestId,error}=await client.rpc("seller_request_withdrawal",{p_amount:data.amount,p_idempotency_key:data.idempotencyKey});
  if(error)throw new Error(error.message||"Could not submit your withdrawal request.");
  return {id:requestId as string};
 });

export const sellerSalesData = createServerFn({method:"POST"})
  .validator((input:{accessToken:string;page:number})=>({
    accessToken:z.string().min(1).parse(input.accessToken),page:pageSchema.parse(input.page),
  }))
  .handler(async({data})=>{
    try{
      const {client,userId}=await requireSeller(data.accessToken);
      const from=(data.page-1)*20, to=from+19;
      const {data:rows,error,count}=await client.from("seller_sales")
        .select("id,created_at,product_title,seller_share,commission_amount,commission_rate,available_on,refunded,buyer_first_name",{count:"exact"})
        .order("created_at",{ascending:false}).range(from,to);
      if(error) throw error;
      return {
        rows:(rows??[]).map(row=>({
          id:row.id,created_at:row.created_at,product_title:row.product_title,
          seller_share:Number(row.seller_share??0),commission_amount:Number(row.commission_amount??0),
          commission_rate:Number(row.commission_rate??0),available_on:row.available_on,
          refunded:row.refunded,buyer_first_name:row.buyer_first_name||"Customer",
        })),
        total:count??0,
      };
    }catch(error){throw new Error(safeMessage(error,"Could not load seller sales."));}
  });
