import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  sellerWalletData, sellerRequestWalletWithdrawal, sellerUpdateWalletUpi,
} from "@/lib/seller-workspace.server-fns";

async function accessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  return data.session.access_token;
}

export const sellerWalletQuery = () => queryOptions({
  queryKey: ["seller","wallet"],
  queryFn: async () => sellerWalletData({ data: { accessToken: await accessToken() } }),
});

export async function updateSellerUpi(upiId: string) {
  return sellerUpdateWalletUpi({ data: { accessToken: await accessToken(), upiId } });
}

export async function requestSellerWithdrawal(amount: number) {
  return sellerRequestWalletWithdrawal({
    data: { accessToken: await accessToken(), amount, idempotencyKey: crypto.randomUUID() },
  });
}
