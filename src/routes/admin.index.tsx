import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminOrdersQuery, adminProductsQuery } from "@/lib/admin";
import { formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function Stat({ label, value, loading }: { label: string; value: string | number; loading: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-7 w-16" /> : <p className="mt-1 text-2xl font-semibold">{value}</p>}
    </div>
  );
}

function AdminDashboard() {
  const products = useQuery(adminProductsQuery(true));
  const orders = useQuery(adminOrdersQuery());

  const list = products.data ?? [];
  const live = list.filter((p) => !p.is_archived);
  const published = live.filter((p) => p.is_active).length;
  const drafts = live.filter((p) => !p.is_active).length;

  const allOrders = orders.data ?? [];
  const pendingVerification = allOrders.filter((o) => o.payment_status === "submitted").length;
  const revenue = allOrders
    .filter((o) => o.payment_status === "verified" && o.order_status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.amount ?? 0), 0);

  const recent = allOrders.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your catalogue and orders.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total products" value={live.length} loading={products.isLoading} />
        <Stat label="Published" value={published} loading={products.isLoading} />
        <Stat label="Drafts" value={drafts} loading={products.isLoading} />
        <Stat label="Total orders" value={allOrders.length} loading={orders.isLoading} />
        <Stat label="Pending verification" value={pendingVerification} loading={orders.isLoading} />
        <Stat label="Verified revenue" value={formatPrice(revenue)} loading={orders.isLoading} />
      </div>

      <section className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Recent orders</h2>
          <Link to="/admin/orders" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        {orders.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : recent.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Payment</th>
                  <th className="px-4 py-2 font-medium">Order</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-2.5">{o.full_name}</td>
                    <td className="max-w-[16rem] truncate px-4 py-2.5">{o.product_title}</td>
                    <td className="px-4 py-2.5">{formatPrice(Number(o.amount))}</td>
                    <td className="px-4 py-2.5">{PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status}</td>
                    <td className="px-4 py-2.5">{ORDER_STATUS_LABELS[o.order_status] ?? o.order_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
