import type { Database } from "@/integrations/supabase/types";
import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminOrdersQuery, friendlyError, type AdminOrder } from "@/lib/admin";
import { formatPrice, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import { signedUrl } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

function AdminOrders() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery(adminOrdersQuery());
  const [busyId, setBusyId] = useState<string | null>(null);
  const mutationLockRef = useRef(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "amount">("newest");

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(data ?? [])]
      .filter((o) => {
        const matches = !term || [o.full_name, o.email, o.product_title, o.transaction_id, o.whatsapp, o.courier_tracking_id, o.delivery_postal_code]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
        const status = statusFilter === "all" || o.payment_status === statusFilter || o.order_status === statusFilter;
        return matches && status;
      })
      .sort((a,b) => sort === "amount" ? Number(b.amount) - Number(a.amount) : sort === "oldest" ? +new Date(a.created_at) - +new Date(b.created_at) : +new Date(b.created_at) - +new Date(a.created_at));
  }, [data, search, statusFilter, sort]);

  const update = async (
    o: AdminOrder,
    patch: Database["public"]["Tables"]["orders"]["Update"],
    message: string,
  ) => {
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusyId(o.id);
    try {
      const { error } = await supabase.from("orders").update(patch).eq("id", o.id);
      if (error) {
        toast.error(friendlyError(error, "Could not update this order."));
        return;
      }
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success(message);
    } catch (err) {
      toast.error(friendlyError(err, "Could not update this order."));
    } finally {
      setBusyId(null);
      mutationLockRef.current = false;
    }
  };

  const openProof = async (path: string, orderId: string) => {
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusyId(orderId);
    try {
      const url = await signedUrl("payment-proofs", path, 300);
      if (!url) {
        toast.error("Could not open the payment screenshot.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } finally {
      setBusyId(null);
      mutationLockRef.current = false;
    }
  };

  const sendWhatsApp = async (o: AdminOrder) => {
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusyId(o.id);
    try {
      if (o.payment_status !== "submitted" || o.order_status === "cancelled") {
        throw new Error("This order is no longer awaiting payment verification.");
      }
      if (!o.whatsapp) throw new Error("This order has no WhatsApp number.");
      if (!o.product_id) throw new Error("This order is missing its product.");

      const { data, error } = await supabase.functions.invoke("verify-and-deliver", {
        body: { orderId: o.id, action: "whatsapp" },
      });

      if (error) throw error;
      if (!data?.downloadUrl || typeof data.downloadUrl !== "string") {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not create the secure R2 download link.");
      }

      let phone = o.whatsapp.replace(/\D/g, "");
      if (phone.startsWith("0")) phone = phone.slice(1);
      if (phone.length === 10) phone = `91${phone}`;

      const message = [
        `Hello ${o.full_name},`,
        "",
        "*Your EduWallet purchase is confirmed!*",
        "",
        `Your payment for *${o.product_title}* has been successfully verified.`,
        "",
        "*Your document is ready:*",
        data.downloadUrl,
        "",
        "This secure download link is valid for *48 hours*.",
        "",
        "If you have any issue accessing the document, please contact support and we’ll assist you.",
        "",
        "Thank you for choosing *EduWallet*.",
        "We appreciate your purchase.",
      ].join("\n");

      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener",
      );
      toast.success("Payment verified, R2 delivery link created, and WhatsApp delivery prepared.");
    } catch (err) {
      toast.error(
        friendlyError(err, "Could not verify the payment and prepare WhatsApp delivery."),
      );
    } finally {
      setBusyId(null);
      mutationLockRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review digital PDF orders separately from physical-copy orders, with courier tracking for shipped items.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"><p>We could not load orders right now. Please try again.</p><Button size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>Retry</Button></div>
      ) : (data ?? []).length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No orders yet.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[1fr_auto_auto]">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, email, product or transaction ID" aria-label="Search orders" className="h-10 bg-background" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter orders by status" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All statuses</option><option value="submitted">Payment submitted</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort orders" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="amount">Highest amount</option>
            </select>
          </div>
          {visibleOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No orders match your filters.</div>
          ) : (
            <div className="space-y-3">
              {visibleOrders.map((o) => {
            const isSubmitted = o.payment_status === "submitted" && o.order_status !== "cancelled";
            const isRejected = o.payment_status === "rejected" && o.order_status !== "cancelled";
            const isCancelled = o.order_status === "cancelled";
            const isVerified = o.payment_status === "verified";

            return (
              <article key={o.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{o.product_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.product_type === "physical" ? "Physical copy" : "Digital PDF"} · Order {o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={isVerified ? "default" : "secondary"}>
                      {PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status}
                    </Badge>
                    <Badge variant="outline">
                      {ORDER_STATUS_LABELS[o.order_status] ?? o.order_status}
                    </Badge>
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{o.full_name}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all">{o.email}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">WhatsApp</dt><dd>{o.whatsapp}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Amount</dt><dd>{formatPrice(Number(o.amount))}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">UPI transaction ID</dt><dd className="break-all">{o.transaction_id ?? "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Payment method</dt><dd>{o.payment_method}</dd></div>
                  {o.product_type === "physical" && <>
                    <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-muted-foreground">Delivery address</dt><dd className="break-words">{[o.delivery_address, o.delivery_city, o.delivery_state, o.delivery_postal_code, o.delivery_country].filter(Boolean).join(", ") || "No shipping address saved"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Courier</dt><dd>{o.courier_name || "—"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Courier tracking ID</dt><dd className="break-all">{o.courier_tracking_id || "—"}</dd></div>
                    <div className="break-all"><dt className="text-xs text-muted-foreground">Tracking URL</dt><dd>{o.courier_tracking_url ? <a className="text-primary underline" href={o.courier_tracking_url} target="_blank" rel="noreferrer">Track shipment</a> : "—"}</dd></div>
                  </>}
                </dl>

                {o.product_type === "physical" && <form className="mt-4 grid gap-3 rounded-lg bg-surface p-3 sm:grid-cols-2" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const courierName = String(formData.get("courier_name") || "").trim();
                  const trackingId = String(formData.get("courier_tracking_id") || "").trim();
                  const trackingUrl = String(formData.get("courier_tracking_url") || "").trim();
                  if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) {
                    toast.error("Tracking URL must start with https://");
                    return;
                  }
                  void update(o, {
                    courier_name: courierName || null,
                    courier_tracking_id: trackingId || null,
                    courier_tracking_url: trackingUrl || null,
                    order_status: trackingId && o.payment_status === "verified" && o.order_status !== "delivered" ? "processing" : o.order_status,
                  }, "Courier details saved.");
                }}>
                  <p className="text-sm font-semibold sm:col-span-2"><Truck className="mr-2 inline h-4 w-4" />Courier / shipment details</p>
                  <Input name="courier_name" aria-label="Courier company" placeholder="Courier company (e.g. India Post)" defaultValue={o.courier_name ?? ""} maxLength={100} />
                  <Input name="courier_tracking_id" aria-label="Courier tracking ID" placeholder="Courier tracking ID" defaultValue={o.courier_tracking_id ?? ""} maxLength={150} />
                  <Input name="courier_tracking_url" aria-label="Courier tracking URL" placeholder="Tracking URL (https://...)" defaultValue={o.courier_tracking_url ?? ""} maxLength={500} className="sm:col-span-2" />
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button type="submit" size="sm" variant="outline" disabled={busyId === o.id}>Save courier details</Button>
                    {o.courier_tracking_id && o.whatsapp && <Button type="button" size="sm" disabled={busyId === o.id} onClick={() => {
                      let phone = o.whatsapp.replace(/\D/g, "");
                      if (phone.startsWith("0")) phone = phone.slice(1);
                      if (phone.length === 10) phone = `91${phone}`;
                      const message = [
                        `Hello ${o.full_name},`,
                        "",
                        `Your EduWallet order for *${o.product_title}* has been prepared for dispatch.`,
                        o.courier_name ? `Courier: ${o.courier_name}` : "",
                        `Courier tracking ID: *${o.courier_tracking_id}*`,
                        o.courier_tracking_url ? `Track your order: ${o.courier_tracking_url}` : "",
                        "",
                        "Thank you for ordering from EduWallet."
                      ].filter(Boolean).join("\n");
                      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
                    }}><MessageCircle className="mr-1 h-4 w-4" />Send tracking via WhatsApp</Button>}
                  </div>
                </form>}

                <div className="mt-4 flex flex-wrap gap-2">
                  {busyId === o.id && <Loader2 className="h-4 w-4 animate-spin self-center" />}

                  {o.screenshot_path && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === o.id}
                      onClick={() => { if (o.screenshot_path) void openProof(o.screenshot_path, o.id); }}
                    >
                      View screenshot
                    </Button>
                  )}

                  {isSubmitted && (
                    <>
                      {o.product_type === "physical" ? (
                        <Button size="sm" disabled={busyId === o.id} onClick={() => void update(o, { payment_status: "verified", order_status: "processing", verified_at: new Date().toISOString() }, "Payment verified. You can now dispatch the physical order.")}>
                          Verify Payment
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busyId === o.id} onClick={() => void sendWhatsApp(o)}>
                          <MessageCircle className="mr-1.5 h-4 w-4" /> Verify & Send PDF via WhatsApp
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === o.id}
                        onClick={() =>
                          void update(
                            o,
                            { payment_status: "rejected", order_status: "payment_rejected" },
                            "Payment rejected. Click Reject Payment again to restore it.",
                          )
                        }
                      >
                        Reject Payment
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === o.id}
                        onClick={() =>
                          void update(
                            o,
                            { order_status: "cancelled" },
                            "Order cancelled. Click Cancel Order again to restore it.",
                          )
                        }
                      >
                        Cancel Order
                      </Button>
                    </>
                  )}

                  {isRejected && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === o.id}
                        onClick={() =>
                          void update(
                            o,
                            { payment_status: "submitted", order_status: "payment_submitted" },
                            "Payment restored. You can verify it again.",
                          )
                        }
                      >
                        Reject Payment
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === o.id}
                        onClick={() =>
                          void update(
                            o,
                            { payment_status: "rejected", order_status: "cancelled" },
                            "Order cancelled.",
                          )
                        }
                      >
                        Cancel Order
                      </Button>
                    </>
                  )}

                  {isVerified && o.product_type === "physical" && o.order_status !== "delivered" && !isCancelled && (
                    <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => void update(o, { order_status: "delivered", delivered_at: new Date().toISOString() }, "Physical order marked as delivered.")}>
                      Mark Delivered
                    </Button>
                  )}

                  {isVerified && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === o.id}
                      onClick={() =>
                        void update(
                          o,
                          { order_status: "cancelled" },
                          "Order cancelled. The dashboard revenue has been adjusted.",
                        )
                      }
                    >
                      Cancel Order
                    </Button>
                  )}

                  {isCancelled && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === o.id}
                        onClick={() =>
                          void update(
                            o,
                            o.payment_status === "verified"
                              ? { payment_status: "verified", order_status: o.product_type === "physical" ? "processing" : "delivered" }
                              : { payment_status: "submitted", order_status: "payment_submitted" },
                            "Order restored. You can continue managing it.",
                          )
                        }
                      >
                        Cancel Order
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === o.id}
                        onClick={() =>
                          void update(
                            o,
                            { payment_status: "rejected", order_status: "payment_rejected" },
                            "Payment rejected.",
                          )
                        }
                      >
                        Reject Payment
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
