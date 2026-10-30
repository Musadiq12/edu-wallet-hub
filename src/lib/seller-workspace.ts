import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  sellerDashboardData, sellerGetProduct, sellerListProducts, sellerSalesData, sellerNotifications,
} from "@/lib/seller-workspace.server-fns";

export async function sellerAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  return data.session.access_token;
}

export const sellerDashboardQuery = () => queryOptions({
  queryKey: ["seller","dashboard"],
  queryFn: async () => sellerDashboardData({ data: { accessToken: await sellerAccessToken() } }),
});

export const sellerProductsQuery = (status = "all") => queryOptions({
  queryKey: ["seller","products",status],
  queryFn: async () => sellerListProducts({ data: { accessToken: await sellerAccessToken(), status } }),
});

export const sellerProductQuery = (id: string) => queryOptions({
  queryKey: ["seller","product",id],
  queryFn: async () => sellerGetProduct({ data: { accessToken: await sellerAccessToken(), id } }),
});

export const sellerSalesQuery = (page: number) => queryOptions({
  queryKey: ["seller","sales",page],
  queryFn: async () => sellerSalesData({ data: { accessToken: await sellerAccessToken(), page } }),
});

export const sellerNotificationsQuery = () => queryOptions({
  queryKey: ["seller","notifications"],
  queryFn: async () => sellerNotifications({ data: { accessToken: await sellerAccessToken() } }),
});
