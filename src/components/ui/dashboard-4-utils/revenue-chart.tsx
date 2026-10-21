import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { salesStatsQuery } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";

const config: ChartConfig = { revenue: { label: "Revenue", color: "#2563eb" } };

export function RevenueChart() {
  const query = useQuery(salesStatsQuery(30));
  const data = query.data?.series ?? [];
  return <section className="min-w-0 rounded-xl border bg-card p-4 shadow-sm md:col-span-2">
    <div className="mb-3"><h2 className="font-semibold">Revenue trend</h2><p className="text-sm text-muted-foreground">Daily verified revenue · last 30 days</p></div>
    {query.isLoading ? <div className="h-64 animate-pulse rounded-lg bg-muted" /> : data.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No sales in this period</p> :
      <ChartContainer config={config} className="h-64 w-full aspect-auto">
        <AreaChart data={data} accessibilityLayer>
          <defs><linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.28}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0.02}/></linearGradient></defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN",{day:"numeric",month:"short"})} />
          <YAxis width={60} tickLine={false} axisLine={false} tickFormatter={(v) => Number(v) >= 1000 ? `₹${(Number(v)/1000).toFixed(1)}k` : `₹${v}`} />
          <Tooltip formatter={(v) => formatPrice(Number(v))} labelFormatter={(v) => new Date(String(v)).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})} />
          <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#dashboardRevenueFill)" />
        </AreaChart>
      </ChartContainer>}
  </section>;
}
