import type { Database } from "@/integrations/supabase/types";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminOrdersQuery, friendlyError, type AdminOrder } from "@/lib/admin";
import { formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import { signedUrl } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

function AdminOrders() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery(adminOrdersQuery());
  const [busyId, setBusyId] = useState<string | null>(null);

  const update = async (o: AdminOrder, patch: Database["public"]["Tables"]["orders"]["Update"], message: string) => {
    setBusyId(o.id);
    const { error } = await supabase.from("orders").update(patch).eq("id", o.id);
    setBusyId(null);
    if (error) return void toast.error(friendlyError(error, "Could not update this order."));
    await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    toast.success(message);
  };

  const openProof = async (path: string) => {
    const url = await signedUrl("payment-proofs", path, 300);
    if (!url) return void toast.error("Could not open the payment screenshot.");
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify UPI payments manually, then deliver the resource by email or WhatsApp.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : isError ? (
        <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          We could not load orders right now. Please refresh and try again.
        </p>
      ) : (data ?? []).length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((o) => (
            <article key={o.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{o.product_title}</p>
                  <p className="text-xs text-muted-foreground">
                    Order {o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={o.payment_status === "verified" ? "default" : "secondary"}>
                    {PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status}
                  </Badge>
                  <Badge variant="outline">{ORDER_STATUS_LABELS[o.order_status] ?? o.order_status}</Badge>
                </div>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{o.full_name}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all">{o.email}</dd></div>
                <div><dt className="text-xs text-muted-foreground">WhatsApp</dt><dd>{o.whatsapp}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Amount</dt><dd>{formatPrice(Number(o.amount))}</dd></div>
                <div><dt className="text-xs text-muted-foreground">UPI transaction ID</dt><dd className="break-all">{o.transaction_id ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Payment method</dt><dd>{o.payment_method}</dd></div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {busyId === o.id && <Loader2 className="h-4 w-4 animate-spin self-center" />}
                {o.screenshot_path && (
                  <Button size="sm" variant="outline" onClick={() => void openProof(o.screenshot_path!)}>
                    View screenshot
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={busyId === o.id || o.payment_status === "verified"}
                  onClick={() =>
                    void update(
                      o,
                      { payment_status: "verified", order_status: "processing", verified_at: new Date().toISOString() },
                      "Payment verified.",
                    )
                  }
                >
                  Verify Payment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === o.id}
                  onClick={() => void update(o, { payment_status: "rejected", order_status: "payment_rejected" }, "Payment rejected.")}
                >
                  Reject Payment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === o.id}
                  onClick={() =>
                    void update(o, { order_status: "delivered", delivered_at: new Date().toISOString() }, "Order marked delivered.")
                  }
                >
                  Mark Delivered
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === o.id}
                  onClick={() => void update(o, { order_status: "cancelled" }, "Order cancelled.")}
                >
                  Cancel Order
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
