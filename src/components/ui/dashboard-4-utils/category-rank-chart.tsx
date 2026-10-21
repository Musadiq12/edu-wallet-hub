import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { salesStatsQuery } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";

const config: ChartConfig = { revenue: { label: "Revenue", color: "#0d9488" } };

export function CategoryRankChart() {
  const query = useQuery(salesStatsQuery(30));
  const data = (query.data?.topProducts ?? []).slice(0,5).map((item) => ({ title: item.title.length > 18 ? item.title.slice(0,18) + "…" : item.title, revenue: item.revenue }));
  return <section className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
    <h2 className="font-semibold">Top products</h2><p className="mt-1 text-sm text-muted-foreground">Ranked by verified revenue</p>
    {query.isLoading ? <div className="mt-4 h-44 animate-pulse rounded-lg bg-muted" /> : data.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No product sales yet</p> :
      <ChartContainer config={config} className="mt-3 h-48 w-full aspect-auto"><BarChart data={data} layout="vertical" margin={{left:4,right:8}}><CartesianGrid horizontal={false} strokeDasharray="3 3"/><XAxis type="number" hide/><YAxis type="category" dataKey="title" width={100} tickLine={false} axisLine={false}/><Tooltip formatter={(v)=>formatPrice(Number(v))}/><Bar dataKey="revenue" fill="#0d9488" radius={[0,5,5,0]} /></BarChart></ChartContainer>}
  </section>;
}
