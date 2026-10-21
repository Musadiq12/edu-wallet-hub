import { useQuery } from "@tanstack/react-query";
import { Clock3, IndianRupee, ShoppingCart, TrendingUp } from "lucide-react";
import { salesStatsQuery } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";

export function DashboardStats() {
  const query = useQuery(salesStatsQuery(30));
  const stats = query.data;
  const cards = [
    { label: "Revenue (30 days)", value: stats ? formatPrice(stats.revenue) : "—", icon: IndianRupee },
    { label: "Verified orders", value: stats ? String(stats.ordersVerified) : "—", icon: ShoppingCart },
    { label: "Average order value", value: stats ? formatPrice(stats.aov) : "—", icon: TrendingUp },
    { label: "Pending verification", value: stats ? String(stats.ordersPending) : "—", icon: Clock3 },
  ];
  return <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:grid-cols-4">
    {cards.map(({label,value,icon:Icon}) => <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4 shrink-0" /></div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{query.isLoading ? "…" : value}</p>
      {query.isError && <p className="mt-1 text-xs text-destructive">Could not load</p>}
    </div>)}
  </div>;
}
