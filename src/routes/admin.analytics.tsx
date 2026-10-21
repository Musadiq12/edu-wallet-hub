import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Clock3, IndianRupee, Package, Receipt, ShoppingCart, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { salesStatsQuery, type AnalyticsRange } from "@/lib/analytics";
import { friendlyError } from "@/lib/admin";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Sales Analytics — Edu Wallet" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SalesAnalytics,
});

const ranges: AnalyticsRange[] = [7, 30, 90];
const chartConfig = { revenue: { label: "Revenue", color: "hsl(var(--chart-1))" }, orders: { label: "Orders", color: "hsl(var(--chart-2))" } };
const labelize = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
const compactRupees = (value: number) => `₹${value >= 100000 ? `${(value / 100000).toFixed(1)}L` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`;

function Metric({ label, value, icon: Icon, tone = "" }: { label: string; value: string | number; icon: typeof IndianRupee; tone?: string }) {
  return <div className="min-w-0 rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{label}</p><Icon className={`h-4 w-4 shrink-0 ${tone}`} /></div><p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p></div>;
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
  return <section className="min-w-0 rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">{title}</h2>{rows.length ? <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div className="h-44 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="value" nameKey="label" innerRadius={42} outerRadius={66}>{rows.map((row, i) => <Cell key={row.label} fill={colors[i % colors.length]} />)}</Pie><Tooltip formatter={(value) => Number(value).toLocaleString("en-IN")} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{rows.map((row, i) => <div key={row.label} className="flex items-start justify-between gap-2 text-sm"><span className="min-w-0 break-words"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />{labelize(row.label)}</span><strong>{row.value}</strong></div>)}</div></div> : <p className="py-8 text-sm text-muted-foreground">No data</p>}</section>;
}

function SalesAnalytics() {
  const [range, setRange] = useState<AnalyticsRange>(30);
  const stats = useQuery(salesStatsQuery(range));
  const data = stats.data;
  const kpis = data ? [
    { label: "Total Revenue", value: formatPrice(data.revenue), icon: IndianRupee },
    { label: "Verified Orders", value: data.ordersVerified, icon: ShoppingCart },
    { label: "Average Order Value", value: formatPrice(data.aov), icon: Receipt },
    { label: "Pending Verification", value: data.ordersPending, icon: Clock3, tone: "text-amber-500" },
    { label: "Cancelled Orders", value: data.ordersCancelled, icon: XCircle },
  ] : [];

  return <div className="min-w-0 space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">Sales Analytics</h1><p className="mt-1 text-sm text-muted-foreground">Aggregated sales performance for the selected period.</p></div><div className="flex gap-2" aria-label="Analytics date range">{ranges.map((days) => <Button key={days} size="sm" variant={range === days ? "default" : "outline"} onClick={() => setRange(days)}>{days}D</Button>)}</div></div>
    {stats.isError ? <div className="rounded-xl border border-destructive/30 p-5"><p className="text-sm">{friendlyError(stats.error, "Could not load sales analytics.")}</p><Button className="mt-3" variant="outline" onClick={() => void stats.refetch()}>Retry</Button></div> : <>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">{stats.isLoading ? ranges.slice(0, 3).map((n) => <Skeleton key={n} className="h-24" />) : kpis.map((kpi) => <Metric key={kpi.label} {...kpi} />)}</div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Revenue over time</h2>{stats.isLoading ? <Skeleton className="mt-4 h-64 w-full" /> : !data?.series.length ? <EmptyState title="No sales in this period" /> : <ChartContainer config={chartConfig} className="mt-4 h-64 w-full aspect-auto"><AreaChart data={data.series}><CartesianGrid vertical={false} /><XAxis dataKey="day" tickFormatter={(value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} /><YAxis tickFormatter={(value) => compactRupees(Number(value))} width={54} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => formatPrice(Number(value))} />} /><Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" fill="var(--color-revenue)" fillOpacity={0.18} /></AreaChart></ChartContainer>}</section>
        <section className="min-w-0 rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Daily orders</h2>{stats.isLoading ? <Skeleton className="mt-4 h-64 w-full" /> : !data?.series.length ? <p className="py-8 text-sm text-muted-foreground">No data</p> : <ChartContainer config={chartConfig} className="mt-4 h-64 w-full aspect-auto"><BarChart data={data.series}><CartesianGrid vertical={false} /><XAxis dataKey="day" hide /><YAxis allowDecimals={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="orders" fill="var(--color-orders)" radius={4} /></BarChart></ChartContainer>}</section>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2"><Breakdown title="Orders by Payment Status" rows={data?.byPayment ?? []} /><Breakdown title="Orders by Order Status" rows={data?.byStatus ?? []} /></div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Digital vs Physical</h2><div className="mt-4 space-y-3">{["pdf", "physical"].map((type) => { const row = data?.byType.find((item) => item.label.toLowerCase() === type); return <div key={type} className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3"><div className="flex min-w-0 items-center gap-2"><Package className="h-4 w-4 shrink-0 text-muted-foreground" /><span>{type === "pdf" ? "Digital (PDF)" : "Physical books"}</span></div>{row ? <div className="text-right text-sm"><p className="font-semibold">{row.orders} orders</p><p className="text-muted-foreground">{formatPrice(row.revenue)}</p></div> : <span className="text-sm text-muted-foreground">No data</span>}</div>; })}</div></section>
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Top Products by Revenue</h2>{!data?.topProducts.length ? <p className="py-8 text-sm text-muted-foreground">No sales in this period</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-2 pr-2">#</th><th className="py-2 pr-2">Product</th><th className="py-2 pr-2">Units</th><th className="py-2 text-right">Revenue</th></tr></thead><tbody>{data.topProducts.map((row, i) => <tr key={row.title} className="border-b last:border-0"><td className="py-2 pr-2">{i + 1}</td><td className="max-w-40 truncate py-2 pr-2">{row.title}</td><td className="py-2 pr-2">{row.units}</td><td className="whitespace-nowrap py-2 text-right">{formatPrice(row.revenue)}</td></tr>)}</tbody></table></div>}</section>
      </div>
      <div className="text-xs text-muted-foreground">Total orders: {data?.ordersTotal ?? 0} · <Link to="/admin/orders" className="underline">View orders</Link></div>
    </>}
  </div>;
}
