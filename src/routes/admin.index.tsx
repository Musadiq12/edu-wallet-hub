import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminOrdersQuery, adminProductsQuery, friendlyError } from "@/lib/admin";
import Dashboard from "@/components/ui/dashboard-4";
import { salesStatsQuery } from "@/lib/analytics";
import { formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

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
  const queryClient = useQueryClient();
  const products = useQuery(adminProductsQuery(true));
  const orders = useQuery(adminOrdersQuery());
  const analytics = useQuery(salesStatsQuery(30));
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

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

  const closeReset = () => {
    if (resetting) return;
    setResetOpen(false);
    setResetPassword("");
    setConfirmText("");
    setResetError("");
  };

  const resetDashboard = async () => {
    if (resetPassword.length < 12 || confirmText !== "DELETE") return;
    setResetting(true);
    setResetError("");
    try {
      const { data, error } = await supabase.functions.invoke("reset-dashboard", {
        body: { password: resetPassword, confirmText },
      });
      if (error) {
        // Supabase Functions errors may expose a Response, a plain object, or no context.
        // Only clone/parse context when it is actually a Response to avoid "clone is not a function".
        let details: { error?: unknown } | null = null;
        const context: unknown = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          try {
            const parsed: unknown = await context.clone().json();
            if (parsed && typeof parsed === "object") {
              details = parsed as { error?: unknown };
            }
          } catch {
            // Keep the SDK's original message when the response body is not JSON.
          }
        } else if (context && typeof context === "object" && "error" in context) {
          details = context as { error?: unknown };
        }
        throw new Error(typeof details?.error === "string" ? details.error : error.message);
      }
      if (!data?.ok) throw new Error(typeof data?.error === "string" ? data.error : "Dashboard reset failed.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "order-status-history"] }),
      ]);
      await queryClient.refetchQueries({ queryKey: ["admin", "orders"] });
      setResetOpen(false);
      setResetPassword("");
      setConfirmText("");
      setResetError("");
      toast.success("Dashboard reset successfully. All sales data was deleted.");
    } catch (error) {
      setResetError(friendlyError(error, error instanceof Error ? error.message : "Dashboard reset failed."));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of your catalogue and orders.</p>
        </div>
        <Button
          variant="destructive"
          className="w-full sm:w-auto"
          onClick={() => { setResetError(""); setResetOpen(true); }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total products" value={live.length} loading={products.isLoading} />
        <Stat label="Published" value={published} loading={products.isLoading} />
        <Stat label="Drafts" value={drafts} loading={products.isLoading} />
        <Stat label="Total orders" value={allOrders.length} loading={orders.isLoading} />
        <Stat label="Pending verification" value={pendingVerification} loading={orders.isLoading} />
        <Stat label="Verified revenue" value={formatPrice(revenue)} loading={orders.isLoading} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Sales analytics</h2>
            <p className="mt-1 text-sm text-muted-foreground">Verified spending, payment verifications and sales performance for the last 30 days.</p>
          </div>
          <span className="text-xs text-muted-foreground">{analytics.isFetching ? "Refreshing…" : "Live order data"}</span>
        </div>
        {analytics.isError ? (
          <div className="rounded-xl border border-destructive/30 p-5">
            <p className="text-sm">{friendlyError(analytics.error, "Could not load sales analytics.")}</p>
            <Button className="mt-3" variant="outline" onClick={() => void analytics.refetch()}>Retry analytics</Button>
          </div>
        ) : <Dashboard />}
      </section>

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

      <Dialog open={resetOpen} onOpenChange={(open) => open ? setResetOpen(true) : closeReset()}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Reset Dashboard
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all sales data. This cannot be undone or recovered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              Orders, payment-related invoice records, and order history will be permanently deleted. Products, customer accounts, and files will remain.
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password">Reset password</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="current-password"
                minLength={12}
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                disabled={resetting}
                required
              />
              <p className="text-xs text-muted-foreground">Enter the reset password (minimum 12 characters).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm">Type DELETE to confirm</Label>
              <Input
                id="reset-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                disabled={resetting}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {resetError && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{resetError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeReset} disabled={resetting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={resetDashboard}
              disabled={resetting || resetPassword.length < 12 || confirmText !== "DELETE"}
            >
              {resetting && <Loader2 className="h-4 w-4 animate-spin" />}
              {resetting ? "Deleting…" : "Delete Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
