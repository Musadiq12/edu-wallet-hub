import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/admin";

export type AnalyticsRange = 7 | 30 | 90;
export type SalesStats = {
  revenue: number;
  ordersTotal: number;
  ordersVerified: number;
  ordersPending: number;
  ordersCancelled: number;
  aov: number;
  series: Array<{ day: string; revenue: number; orders: number }>;
  byStatus: Array<{ label: string; value: number }>;
  byPayment: Array<{ label: string; value: number }>;
  byType: Array<{ label: string; orders: number; revenue: number }>;
  topProducts: Array<{ title: string; units: number; revenue: number }>;
};

export const salesStatsQuery = (range: AnalyticsRange) => queryOptions({
  queryKey: ["admin", "sales-analytics", range],
  staleTime: 60_000,
  queryFn: async (): Promise<SalesStats> => {
    const to = new Date(Date.now() + 60_000);
    const from = new Date(to.getTime() - range * 24 * 60 * 60 * 1000);
    const rpc = supabase.rpc as unknown as (name: string, args: { p_from: string; p_to: string }) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc("admin_sales_stats", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    if (error) throw new Error(friendlyError(error, error.message || "Could not load sales analytics."));
    return data as unknown as SalesStats;
  },
});
