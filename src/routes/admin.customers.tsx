import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { adminCustomersQuery, adminOrdersQuery } from "@/lib/admin";

export const Route = createFileRoute("/admin/customers")({ component: AdminCustomers });

function AdminCustomers() {
  const { data, isLoading, isError } = useQuery(adminCustomersQuery());
  const { data: orders } = useQuery(adminOrdersQuery());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "orders">("newest");
  const orderCount = (id: string) => (orders ?? []).filter((o) => o.user_id === id).length;
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(data ?? [])].filter((c) => !term || [c.full_name, c.email, c.whatsapp].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)))
      .sort((a,b) => sort === "orders" ? orderCount(b.id) - orderCount(a.id) : +new Date(b.created_at) - +new Date(a.created_at));
  }, [data, search, sort, orders]);

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
        <div className="space-y-3">
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or WhatsApp" aria-label="Search customers" className="h-10 bg-background" />
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort customers" className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="newest">Newest first</option><option value="orders">Most orders</option></select>
          </div>
          {visible.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No customers match your search.</div> : (
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
              {visible.map((c) => (
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
      )}
    </div>
  );
}
