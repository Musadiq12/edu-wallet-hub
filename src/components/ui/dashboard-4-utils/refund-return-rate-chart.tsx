import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { salesStatsQuery } from "@/lib/analytics";

const colors = ["#0d9488", "#f59e0b", "#e11d48"];

export function RefundReturnRateChart() {
  const query = useQuery(salesStatsQuery(30));
  const stats = query.data;
  const verified = stats?.ordersVerified ?? 0;
  const cancelled = stats?.ordersCancelled ?? 0;
  const pending = stats?.ordersPending ?? 0;
  const total = verified + cancelled + pending;
  const data = [{name:"Verified",value:verified},{name:"Pending",value:pending},{name:"Cancelled",value:cancelled}].filter(x => x.value > 0);
  const cancelledRate = total ? Math.round(cancelled / total * 100) : 0;
  return <section className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
    <h2 className="font-semibold">Order status mix</h2><p className="mt-1 text-sm text-muted-foreground">Last 30 days</p>
    {query.isLoading ? <div className="mt-4 h-44 animate-pulse rounded-lg bg-muted" /> : total === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No orders in this period</p> :
      <div className="mt-2 grid grid-cols-2 items-center gap-2">
        <div className="h-40 min-w-0"><PieChart width={180} height={160}><Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={3} stroke="hsl(var(--card))" strokeWidth={3}>{data.map((entry,i)=><Cell key={entry.name} fill={colors[["Verified","Pending","Cancelled"].indexOf(entry.name)] ?? colors[i]} />)}</Pie><Tooltip /></PieChart></div>
        <div className="space-y-3 text-sm">{data.map((entry)=> <div key={entry.name} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{backgroundColor:colors[["Verified","Pending","Cancelled"].indexOf(entry.name)]}} />{entry.name}</span><strong>{entry.value}</strong></div>)}</div>
      </div>}
    <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">Cancelled orders: <strong className="text-foreground">{query.isLoading ? "—" : `${cancelledRate}%`}</strong></p>
  </section>;
}
