import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminCustomersQuery, adminOrdersQuery } from "@/lib/admin";

export const Route = createFileRoute("/admin/customers")({ component: AdminCustomers });

function AdminCustomers() {
  const { data, isLoading, isError } = useQuery(adminCustomersQuery());
  const { data: orders } = useQuery(adminOrdersQuery());

  const orderCount = (id: string) => (orders ?? []).filter((o) => o.user_id === id).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registered students. This information is visible to administrators only.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : isError ? (
        <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          We could not load customers right now. Please refresh and try again.
        </p>
      ) : (data ?? []).length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">No registered customers yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">WhatsApp</th>
                <th className="px-4 py-2.5 font-medium">Orders</th>
                <th className="px-4 py-2.5 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3">{c.full_name ?? "—"}</td>
                  <td className="px-4 py-3 break-all">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">{c.whatsapp ?? "—"}</td>
                  <td className="px-4 py-3">{orderCount(c.id)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
