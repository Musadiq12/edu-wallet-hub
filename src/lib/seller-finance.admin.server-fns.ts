import { env as workerEnv } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function env(name: string) {
  const fallbacks: Record<string,string|undefined> = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  const value = process.env[name] || workerEnv[name as keyof typeof workerEnv] || fallbacks[name];
  if (!value) throw new Error("Server configuration is missing " + name + ".");
  return value;
}

async function requireFinanceAdmin(accessToken: string) {
  if (typeof accessToken !== "string" || accessToken.split(".").length !== 3) throw new Error("Please sign in to continue.");
  const url=env("SUPABASE_URL");
  const publishableKey=env("SUPABASE_PUBLISHABLE_KEY");
  const userClient=createClient(url,publishableKey,{
    global:{headers:{Authorization:"Bearer "+accessToken}},
    auth:{persistSession:false,autoRefreshToken:false},
  });
  const {data:claims,error:claimsError}=await userClient.auth.getClaims(accessToken);
  const userId=claims?.claims?.sub;
  if(claimsError||typeof userId!=="string"||!z.string().uuid().safeParse(userId).success) throw new Error("Please sign in to continue.");
  const adminClient=createClient(url,env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
  const [{data:adminUser,error:adminUserError},{data:adminRole,error:adminRoleError}] = await Promise.all([
    adminClient.from("admin_users").select("user_id").eq("user_id",userId).eq("is_active",true).maybeSingle(),
    adminClient.from("user_roles").select("user_id").eq("user_id",userId).eq("role","admin").maybeSingle(),
  ]);
  if(adminUserError||adminRoleError||(!adminUser&&!adminRole)) throw new Error("Administrator access required.");
  // Use the user's JWT-bound client so SECURITY DEFINER RPCs still evaluate auth.uid().
  return userClient;
}

const idSchema=z.string().uuid();
export const adminSellerWallets=createServerFn({method:"POST"})
 .validator((input:{accessToken:string})=>({accessToken:z.string().min(1).parse(input.accessToken)}))
 .handler(async({data})=>{
  const client=await requireFinanceAdmin(data.accessToken);
  const {data:rows,error}=await client.rpc("admin_seller_wallets");
  if(error) throw new Error("Could not load seller accounts.");
  return rows??[];
 });

export const adminSetSellerSuspension=createServerFn({method:"POST"})
 .validator((input:{accessToken:string;sellerId:string;suspended:boolean;reason?:string})=>({
  accessToken:z.string().min(1).parse(input.accessToken),
  sellerId:idSchema.parse(input.sellerId),
  suspended:z.boolean().parse(input.suspended),
  reason:input.suspended?z.string().trim().min(3).max(1000).parse(input.reason):null,
 }))
 .handler(async({data})=>{
  const client=await requireFinanceAdmin(data.accessToken);
  const {error}=await client.rpc("admin_set_seller_suspension",{
   p_seller_id:data.sellerId,p_suspended:data.suspended,p_reason:data.reason,
  });
  if(error) throw new Error(error.message||"Could not update seller status.");
  return {ok:true};
 });

export const adminWithdrawalQueue=createServerFn({method:"POST"})
 .validator((input:{accessToken:string})=>({accessToken:z.string().min(1).parse(input.accessToken)}))
 .handler(async({data})=>{
  const client=await requireFinanceAdmin(data.accessToken);
  const {data:rows,error}=await client.rpc("admin_withdrawal_queue");
  if(error) throw new Error("Could not load withdrawal queue.");
  return Array.isArray(rows)?rows:[];
 });

export const adminTransitionWithdrawal=createServerFn({method:"POST"})
 .validator((input:{accessToken:string;requestId:string;status:"processing"|"paid"|"rejected";reason?:string;upiReference?:string})=>({
  accessToken:z.string().min(1).parse(input.accessToken),
  requestId:idSchema.parse(input.requestId),
  status:z.enum(["processing","paid","rejected"]).parse(input.status),
  reason:input.status==="rejected"?z.string().trim().min(3).max(1000).parse(input.reason):null,
  upiReference:z.string().trim().max(120).optional(),
 }))
 .handler(async({data})=>{
  const client=await requireFinanceAdmin(data.accessToken);
  const {error}=await client.rpc("admin_transition_withdrawal",{
   p_request_id:data.requestId,p_status:data.status,p_reason:data.reason,p_upi_reference:data.upiReference??null,
  });
  if(error) throw new Error(error.message||"Could not update withdrawal status.");
  return {ok:true};
 });

export const adminGetMarketplaceCommission=createServerFn({method:"POST"})
 .validator((input:{accessToken:string})=>({accessToken:z.string().min(1).parse(input.accessToken)}))
 .handler(async({data})=>{
  const client=await requireFinanceAdmin(data.accessToken);
  const {data:rows,error}=await client.rpc("admin_get_marketplace_commission");
  if(error) throw new Error("Could not load commission settings.");
  return Array.isArray(rows)?rows[0]??{commission_rate:0,updated_at:null}:{commission_rate:0,updated_at:null};
 });

export const adminSetMarketplaceCommission=createServerFn({method:"POST"})
 .validator((input:{accessToken:string;rate:number})=>({
  accessToken:z.string().min(1).parse(input.accessToken),
  rate:z.number().finite().min(0).max(100).refine(v=>Math.round(v*100)===v*100,"Use at most two decimal places."),
 }))
 .handler(async({data})=>{
  const client=await requireFinanceAdmin(data.accessToken);
  const {error}=await client.rpc("admin_set_marketplace_commission",{p_rate:data.rate});
  if(error) throw new Error(error.message||"Could not update commission.");
  return {ok:true};
 });
