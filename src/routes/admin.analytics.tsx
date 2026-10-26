import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import Dashboard from "@/components/ui/dashboard-4";
import { salesStatsQuery } from "@/lib/analytics";
import { friendlyError } from "@/lib/admin";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Sales Analytics — EduWallet" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SalesAnalytics,
});

function SalesAnalytics() {
  const stats = useQuery(salesStatsQuery(30));
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aggregated sales performance for the last 30 days.</p>
      </div>
      {stats.isError ? (
        <div className="rounded-xl border border-destructive/30 p-5">
          <p className="text-sm">{stats.error instanceof Error ? stats.error.message : friendlyError(stats.error, "Could not load sales analytics.")}</p>
          <Button className="mt-3" variant="outline" onClick={() => void stats.refetch()}>Retry</Button>
        </div>
      ) : <Dashboard />}
    </div>
  );
}
