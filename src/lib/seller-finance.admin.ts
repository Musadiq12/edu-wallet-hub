import { supabase } from "@/integrations/supabase/client";
import {
  adminGetMarketplaceCommission, adminSetMarketplaceCommission, adminSellerWallets,
  adminSetSellerSuspension, adminTransitionWithdrawal, adminWithdrawalQueue,
  adminGetSellerPayoutPolicy, adminSetSellerPayoutPolicy,
} from "@/lib/seller-finance.admin.server-fns";

async function token(){
 const {data,error}=await supabase.auth.getSession();
 if(error||!data.session?.access_token)throw new Error("Your session has expired. Please sign in again.");
 return data.session.access_token;
}
export const adminSellerWalletsQuery=()=>({
 queryKey:["admin","seller-wallets"],
 queryFn:async()=>adminSellerWallets({data:{accessToken:await token()}}),
});
export const adminWithdrawalsQuery=()=>({
 queryKey:["admin","withdrawals"],
 queryFn:async()=>adminWithdrawalQueue({data:{accessToken:await token()}}),
});
export const adminCommissionQuery=()=>({
 queryKey:["admin","commission"],
 queryFn:async()=>adminGetMarketplaceCommission({data:{accessToken:await token()}}),
});
export async function setSellerSuspension(sellerId:string,suspended:boolean,reason?:string){
 return adminSetSellerSuspension({data:{accessToken:await token(),sellerId,suspended,reason}});
}
export async function transitionWithdrawal(requestId:string,status:"processing"|"paid"|"rejected",reason?:string,upiReference?:string){
 return adminTransitionWithdrawal({data:{accessToken:await token(),requestId,status,reason,upiReference}});
}
export async function setMarketplaceCommission(rate:number){
 return adminSetMarketplaceCommission({data:{accessToken:await token(),rate}});
}

export const sellerPayoutPolicyQuery=()=>({
 queryKey:["admin","seller-payout-policy"],
 queryFn:async()=>adminGetSellerPayoutPolicy({data:{accessToken:await token()}}),
});
export async function setSellerPayoutPolicy(holdEnabled:boolean,reserveEnabled:boolean){
 return adminSetSellerPayoutPolicy({data:{accessToken:await token(),holdEnabled,reserveEnabled}});
}
