import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ExternalLink, FileText, Loader2, MessageCircle, PackageCheck, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminOrdersQuery, friendlyError, type AdminOrder } from "@/lib/admin";
import { formatPrice } from "@/lib/format";
import { signedUrl } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { PostgrestClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

type OrderStatus = AdminOrder["status"];
type HistoryItem = { id: string; status: OrderStatus; changed_at: string };

// This optional feature is deployed separately from the generated core schema.
type HistorySchema = {
  Tables: {
    order_status_history: {
      Row: HistoryItem & { order_id: string };
      Insert: never;
      Update: never;
      Relationships: [];
    };
  };
  Views: {};
  Functions: {};
};

const STATUSES: { value: "All" | OrderStatus; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Payment Verified", label: "Payment Verified" },
  { value: "Dispatched", label: "Dispatched" },
  { value: "Cancelled", label: "Cancelled" },
];

const statusStyles: Record<OrderStatus, string> = {
  Pending: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  "Payment Verified": "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  Dispatched: "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
  Cancelled: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
};

function normalizePhone(phone: string) {
  // WhatsApp wa.me URLs must contain digits only: no +, spaces, brackets, or hyphens.
  let digits = (phone ?? "").replace(/\D/g, "");
  digits = digits.replace(/^0+/, "");
  // Checkout phone numbers without a country code are assumed to be Indian numbers.
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

function AdminOrders() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery(adminOrdersQuery());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [digitalLinks, setDigitalLinks] = useState<Record<string, string>>({});

  const historyQuery = useQuery({
    queryKey: ["admin", "order-status-history", expandedId],
    enabled: !!expandedId,
    queryFn: async (): Promise<HistoryItem[]> => {
      if (!expandedId) return [];
      const historyClient = supabase.schema("public") as unknown as PostgrestClient<HistorySchema>;
      const { data: rows, error } = await historyClient
        .from("order_status_history")
        .select("id,status,changed_at")
        .eq("order_id", expandedId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as HistoryItem[];
    },
  });

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(data ?? [])]
      .filter((order) => {
        const matchesSearch =
          !term ||
          [order.id, order.full_name, order.whatsapp, order.product_title]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term));
        return matchesSearch && (statusFilter === "All" || order.status === statusFilter);
      })
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [data, search, statusFilter]);

  const updateOrder = async (
    order: AdminOrder,
    patch: {
      status?: OrderStatus;
      payment_status?: "pending" | "submitted" | "verified" | "rejected";
      order_status?: "pending_payment" | "payment_submitted" | "payment_verified" | "payment_rejected" | "processing" | "delivered" | "cancelled";
      verified_at?: string | null;
      dispatched_at?: string | null;
      delivered_at?: string | null;
      courier_name?: string | null;
      courier_tracking_id?: string | null;
      courier_tracking_url?: string | null;
      whatsapp_sent_at?: string | null;
    },
    successMessage: string,
  ) => {
    setBusyId(order.id);
    try {
      const corePatch: TablesUpdate<"orders"> = patch;
      const { error } = await supabase.from("orders").update(corePatch).eq("id", order.id);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "orders"] }),
        qc.invalidateQueries({ queryKey: ["admin", "order-status-history", order.id] }),
      ]);
      toast.success(successMessage);
    } catch (error) {
      toast.error(friendlyError(error, "Could not update this order."));
    } finally {
      setBusyId(null);
    }
  };

  const verifyPayment = async (order: AdminOrder) => {
    if (order.status !== "Pending") return;
    if (!window.confirm(`Verify payment for order #${order.id}? Make sure the payment has reached your account.`)) return;
    await updateOrder(order, {
      status: "Payment Verified",
      payment_status: "verified",
      order_status: "payment_verified",
      verified_at: new Date().toISOString(),
    }, "Payment verified.");
  };

  const cancelOrder = async (order: AdminOrder) => {
    if (order.status === "Cancelled") return;
    if (!window.confirm(`Cancel order #${order.id}? This action will be recorded in the order history.`)) return;
    await updateOrder(order, {
      status: "Cancelled",
      payment_status: order.payment_status === "verified" ? "verified" : "rejected",
      order_status: "cancelled",
    }, "Order cancelled.");
  };

  const dispatchOrder = async (order: AdminOrder, form: HTMLFormElement) => {
    if (order.product_type !== "physical") {
      toast.error("Courier dispatch is only available for physical products.");
      return;
    }
    if (order.status !== "Payment Verified" || order.payment_status !== "verified") {
      toast.error("Verify payment before dispatching this order.");
      return;
    }
    const values = new FormData(form);
    const courier = String(values.get("courier_name") || "").trim();
    const trackingId = String(values.get("courier_tracking_id") || "").trim();
    const trackingUrl = String(values.get("courier_tracking_url") || "").trim();
    if (!courier) {
      toast.error("Choose a courier company.");
      return;
    }
    if (!trackingId) {
      toast.error("Tracking ID / courier number is required.");
      return;
    }
    if (courier === "Other" && !trackingUrl) {
      toast.error("A tracking URL is required when the courier is Other.");
      return;
    }
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      toast.error("Enter a valid tracking URL starting with http:// or https://.");
      return;
    }
    if (!window.confirm(`Dispatch order #${order.id} with ${courier}, tracking ID ${trackingId}?`)) return;
    await updateOrder(order, {
      status: "Dispatched",
      order_status: "processing",
      courier_name: courier,
      courier_tracking_id: trackingId,
      courier_tracking_url: trackingUrl || null,
      dispatched_at: new Date().toISOString(),
    }, "Order dispatched and tracking details saved.");
  };

  const verifyAndDeliver = async (order: AdminOrder) => {
    if (order.product_type !== "pdf") {
      toast.error("Digital delivery is only available for PDF products.");
      return;
    }
    if (order.payment_status === "verified" && order.order_status === "delivered") {
      toast.error("This PDF order has already been delivered. Use the WhatsApp action to resend its link.");
      return;
    }
    if (!window.confirm(`Verify payment and deliver the PDF for order #${order.id}? Confirm that payment has reached your account.`)) return;

    setBusyId(order.id);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your admin session has expired. Please sign in again.");

      const { data, error } = await supabase.functions.invoke("verify-and-deliver", {
        body: { orderId: order.id, action: "verify" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Digital delivery failed.");
      if (typeof data?.downloadUrl === "string") {
        setDigitalLinks((current) => ({ ...current, [order.id]: data.downloadUrl }));
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "orders"] }),
        qc.invalidateQueries({ queryKey: ["my-library", order.user_id] }),
      ]);
      toast.success(data.message || "Payment verified and PDF delivered.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not verify and deliver this PDF. You can safely retry."));
    } finally {
      setBusyId(null);
    }
  };

  const requestDigitalLink = async (order: AdminOrder): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("verify-and-deliver", {
      body: { orderId: order.id, action: "whatsapp" },
    });
    if (error) throw error;
    if (!data?.ok || typeof data?.downloadUrl !== "string") {
      throw new Error(data?.error || "Could not create a secure PDF link.");
    }
    setDigitalLinks((current) => ({ ...current, [order.id]: data.downloadUrl }));
    return data.downloadUrl as string;
  };

  const generateDigitalLink = async (order: AdminOrder) => {
    if (
      order.product_type !== "pdf" ||
      order.payment_status !== "verified" ||
      order.order_status !== "delivered"
    ) {
      toast.error("Deliver the PDF successfully before generating a customer link.");
      return;
    }
    setBusyId(order.id);
    try {
      await requestDigitalLink(order);
      toast.success("Secure PDF link generated. It expires after 48 hours.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not generate a secure PDF link."));
    } finally {
      setBusyId(null);
    }
  };

  const openDigitalWhatsApp = async (order: AdminOrder) => {
    if (
      order.product_type !== "pdf" ||
      order.payment_status !== "verified" ||
      order.order_status !== "delivered"
    ) {
      toast.error("Verify payment and deliver the PDF before sharing it.");
      return;
    }
    if (!order.whatsapp) {
      toast.error("This order has no customer phone number.");
      return;
    }
    const phone = normalizePhone(order.whatsapp);
    if (!phone) {
      toast.error("The customer phone number is invalid.");
      return;
    }
    const whatsappWindow = window.open("about:blank", "_blank");
    if (!whatsappWindow) {
      toast.error("Allow pop-ups to open WhatsApp and send the PDF link.");
      return;
    }
    whatsappWindow.opener = null;
    setBusyId(order.id);
    try {
      // Always create a fresh URL so an expired 48-hour link is never reused.
      const downloadUrl = await requestDigitalLink(order);
      const message = `Hi ${order.full_name || "there"}, your payment for ${order.product_title} (order #${order.id}) has been verified. Download your PDF here: ${downloadUrl}\nYou can also access it anytime from My Library after signing in to EduWallet.`;
      whatsappWindow.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      toast.success("WhatsApp opened. The message is not marked as sent automatically.");
    } catch (error) {
      whatsappWindow.close();
      toast.error(friendlyError(error, "Could not prepare the WhatsApp PDF link."));
    } finally {
      setBusyId(null);
    }
  };

  const openPaymentProof = async (order: AdminOrder) => {
    if (!order.screenshot_path) return;
    setBusyId(order.id);
    try {
      const url = await signedUrl("payment-proofs", order.screenshot_path, 300);
      if (!url) throw new Error("Could not open the payment proof.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(friendlyError(error, "Could not open the payment proof."));
    } finally {
      setBusyId(null);
    }
  };

  const openWhatsApp = (order: AdminOrder) => {
    if (order.product_type !== "physical" || order.status !== "Dispatched") {
      toast.error("Tracking messages are only available for dispatched physical orders.");
      return;
    }
    if (!order.whatsapp) {
      toast.error("This order has no customer phone number.");
      return;
    }
    if (!order.courier_name || !order.courier_tracking_id) {
      toast.error("Save the courier name and tracking ID before messaging the customer.");
      return;
    }
    const phone = normalizePhone(order.whatsapp);
    if (!phone) {
      toast.error("The customer phone number is invalid.");
      return;
    }
    const message = `Hi ${order.full_name}, your order for ${order.product_title || "your purchased book"} has been confirmed and dispatched! 📦
Courier: ${order.courier_name}
Tracking ID: ${order.courier_tracking_id}
Track your order here: ${order.courier_tracking_url || "Please check the courier's official tracking page."}
Thank you for shopping with us!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    toast.success("WhatsApp opened. After sending the message, return here and mark it as sent.");
  };

  const markWhatsAppSent = async (order: AdminOrder) => {
    if (order.product_type !== "physical" || order.status !== "Dispatched") return;
    if (!window.confirm("Confirm that you sent the WhatsApp message to the customer?")) return;
    await updateOrder(order, { whatsapp_sent_at: new Date().toISOString() }, "WhatsApp message marked as sent.");
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verify payments, deliver digital PDFs, and dispatch physical books.</p>
      </header>

      <section className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID, customer name, or phone" aria-label="Search orders by ID, customer name, or phone" className="h-11 pl-9" />
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter orders by status">
          {STATUSES.map((status) => (
            <button
              key={status.value}
              type="button"
              role="tab"
              aria-selected={statusFilter === status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${statusFilter === status.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
            >
              {status.label}
              {status.value === "All" ? ` (${data?.length ?? 0})` : ` (${(data ?? []).filter((order) => order.status === status.value).length})`}
            </button>
          ))}
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 w-full" />)}</div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 p-5 text-sm">
          <p>We could not load orders right now. Please try again.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>Retry</Button>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {data?.length ? "No orders match your search or selected status." : "No orders have been placed yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const expanded = expandedId === order.id;
            const busy = busyId === order.id;
            return (
              <article key={order.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  aria-expanded={expanded}
                  className="flex w-full min-w-0 items-start justify-between gap-3 p-4 text-left hover:bg-muted/30 sm:items-center sm:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">#{order.id}</span>
                      <Badge className={order.product_type === "pdf" && order.order_status === "delivered" ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200" : statusStyles[order.status]}>{order.product_type === "pdf" && order.order_status === "delivered" ? "Delivered" : order.status}</Badge>
                    </div>
                    <p className="truncate text-sm font-medium">{order.full_name} · {order.whatsapp}</p>
                    <p className="text-sm text-muted-foreground">{order.product_type === "physical" ? "Physical copy" : "Digital PDF"} · {order.product_title} · {formatPrice(Number(order.amount))}</p>
                    <p className="break-all text-xs text-muted-foreground">{order.transaction_id ? `Transaction ID: ${order.transaction_id}` : order.screenshot_path ? "Payment proof attached" : "Payment proof not attached"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <ChevronDown className={`mt-1 h-5 w-5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                {expanded && (
                  <div className="space-y-5 border-t border-border p-4 sm:p-5">
                    <section>
                      <h2 className="mb-3 text-sm font-semibold">Order and customer details</h2>
                      <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                        <div><dt className="text-xs text-muted-foreground">Order ID</dt><dd className="break-all font-mono">{order.id}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Customer name</dt><dd>{order.full_name}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{order.whatsapp || "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all">{order.email || "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Product type</dt><dd>{order.product_type === "physical" ? "Physical copy" : "Digital PDF"}</dd></div><div><dt className="text-xs text-muted-foreground">Product</dt><dd>{order.product_title}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="font-semibold">{formatPrice(Number(order.amount))}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Order date</dt><dd>{new Date(order.created_at).toLocaleString()}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Payment method</dt><dd>{order.payment_method}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Transaction ID</dt><dd className="break-all">{order.transaction_id || "Not provided"}</dd></div>
                        {order.product_type === "physical" && <div className="sm:col-span-2 xl:col-span-3"><dt className="text-xs text-muted-foreground">Delivery address</dt><dd className="break-words">{[order.delivery_address, order.delivery_city, order.delivery_state, order.delivery_postal_code, order.delivery_country].filter(Boolean).join(", ") || "No address recorded"}</dd></div>}
                        <div><dt className="text-xs text-muted-foreground">Payment verified</dt><dd>{order.verified_at ? new Date(order.verified_at).toLocaleString() : "—"}</dd></div>
                        {order.product_type === "physical" && <div><dt className="text-xs text-muted-foreground">Dispatched</dt><dd>{order.dispatched_at ? new Date(order.dispatched_at).toLocaleString() : "—"}</dd></div>}
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.screenshot_path && <Button size="sm" variant="outline" disabled={busy} onClick={() => void openPaymentProof(order)}>View payment proof</Button>}
                        {order.product_type === "physical" && order.courier_tracking_url && <Button size="sm" variant="outline" asChild><a href={order.courier_tracking_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Open tracking page</a></Button>}
                      </div>
                    </section>

                    <section className="rounded-lg border border-border p-3 sm:p-4">
                      <h2 className="mb-3 text-sm font-semibold">Order actions</h2>
                      {order.status === "Pending" && order.product_type === "physical" && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={busy} onClick={() => void verifyPayment(order)}>Verify Payment</Button>
                          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void cancelOrder(order)}>Reject / Cancel</Button>
                        </div>
                      )}

                      {order.product_type === "pdf" && order.payment_status !== "verified" && order.order_status !== "cancelled" && order.status !== "Cancelled" && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={busy} onClick={() => void verifyAndDeliver(order)}>
                            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <FileText className="mr-1.5 h-4 w-4" />Verify & Deliver PDF
                          </Button>
                          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void cancelOrder(order)}>Reject / Cancel</Button>
                        </div>
                      )}

                      {order.product_type === "pdf" && order.payment_status === "verified" && order.order_status !== "delivered" && order.order_status !== "cancelled" && order.status !== "Cancelled" && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={busy} onClick={() => void verifyAndDeliver(order)}>
                            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <FileText className="mr-1.5 h-4 w-4" />Finish PDF Delivery
                          </Button>
                          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void cancelOrder(order)}>Cancel Order</Button>
                        </div>
                      )}

                      {order.product_type === "pdf" && order.payment_status === "verified" && order.order_status === "delivered" && (
                        <div className="space-y-3">
                          <p className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300"><CheckCircle2 className="h-4 w-4" />Payment verified. The PDF can be delivered securely.</p>
                          <div className="flex flex-wrap gap-2">
                            {digitalLinks[order.id] && <Button size="sm" variant="outline" asChild><a href={digitalLinks[order.id]} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Open secure PDF link</a></Button>}
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => void generateDigitalLink(order)}><FileText className="mr-1.5 h-4 w-4" />{digitalLinks[order.id] ? "Refresh secure PDF link" : "Generate secure PDF link"}</Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" disabled={busy} onClick={() => void openDigitalWhatsApp(order)}><MessageCircle className="mr-1.5 h-4 w-4" />Send PDF via WhatsApp</Button>
                          </div>
                          {order.delivered_at && <p className="text-xs text-muted-foreground">Digital delivery recorded: {new Date(order.delivered_at).toLocaleString()}</p>}
                          <p className="text-xs text-muted-foreground">My Library: after signing in, the customer can open this purchase from their My Library page. The secure link sent through WhatsApp expires after 48 hours; the library remains the long-term access point. WhatsApp is not marked as sent automatically.</p>
                        </div>
                      )}

                      {/* Courier/tracking controls must never render for digital PDF orders. */}
                      {order.product_type === "physical" && order.status === "Payment Verified" && (
                        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void dispatchOrder(order, event.currentTarget); }}>
                          <div className="sm:col-span-2 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300"><PackageCheck className="h-4 w-4" />Payment verified. Add courier details to dispatch.</div>
                          <label className="grid gap-1.5 text-sm">
                            <span>Courier company</span>
                            <select name="courier_name" defaultValue={order.courier_name || ""} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" required>
                              <option value="" disabled>Select courier</option>
                              <option>India Post</option><option>DTDC</option><option>Delhi</option><option>Blue Dart</option><option>Other</option>
                            </select>
                          </label>
                          <label className="grid gap-1.5 text-sm">
                            <span>Tracking ID / courier number</span>
                            <Input name="courier_tracking_id" defaultValue={order.courier_tracking_id || ""} placeholder="Enter tracking ID" required maxLength={150} />
                          </label>
                          <label className="grid gap-1.5 text-sm sm:col-span-2">
                            <span>Tracking URL <span className="text-muted-foreground">(required for Other)</span></span>
                            <Input name="courier_tracking_url" type="url" defaultValue={order.courier_tracking_url || ""} placeholder="https://..." maxLength={500} />
                          </label>
                          <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Truck className="mr-1.5 h-4 w-4" />Dispatch Order</Button>
                            <Button type="button" variant="destructive" disabled={busy} onClick={() => void cancelOrder(order)}>Cancel Order</Button>
                          </div>
                        </form>
                      )}

                      {order.status === "Dispatched" && order.product_type === "physical" && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-green-700 dark:text-green-300">
                            <CheckCircle2 className="h-4 w-4" />Dispatched{order.dispatched_at ? ` on ${new Date(order.dispatched_at).toLocaleString()}` : ""}
                          </div>
                          <dl className="grid gap-2 text-sm sm:grid-cols-2">
                            <div><dt className="text-xs text-muted-foreground">Courier</dt><dd>{order.courier_name || "—"}</dd></div>
                            <div><dt className="text-xs text-muted-foreground">Tracking ID</dt><dd className="break-all">{order.courier_tracking_id || "—"}</dd></div>
                          </dl>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => openWhatsApp(order)}>
                              <MessageCircle className="mr-1.5 h-4 w-4" />{order.whatsapp_sent_at ? "Resend WhatsApp Message" : "Send WhatsApp Message"}
                            </Button>
                            {order.whatsapp_sent_at ? (
                              <Badge className="border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />WhatsApp sent</Badge>
                            ) : (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => void markWhatsAppSent(order)}>Mark WhatsApp Sent</Button>
                            )}
                          </div>
                          {order.whatsapp_sent_at && <p className="text-xs text-muted-foreground">Last marked sent: {new Date(order.whatsapp_sent_at).toLocaleString()}</p>}
                        </div>
                      )}

                      {order.status === "Cancelled" && <p className="text-sm text-muted-foreground">This order has been cancelled.</p>}
                      {order.status !== "Cancelled" && order.status !== "Dispatched" && order.status !== "Payment Verified" && order.status !== "Pending" && <p className="text-sm text-muted-foreground">No actions available for this status.</p>}
                    </section>

                    <section>
                      <h2 className="mb-3 text-sm font-semibold">Status history</h2>
                      {historyQuery.isLoading ? <Skeleton className="h-12 w-full" /> : historyQuery.isError ? (
                        <p className="text-sm text-muted-foreground">Could not load status history.</p>
                      ) : (historyQuery.data ?? []).length ? (
                        <ol className="space-y-3 border-l border-border pl-4">
                          {(historyQuery.data ?? []).map((item) => (
                            <li key={item.id} className="relative">
                              <span className="absolute -left-[1.32rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                              <p className="text-sm font-medium">{item.status}</p>
                              <p className="text-xs text-muted-foreground">{new Date(item.changed_at).toLocaleString()}</p>
                            </li>
                          ))}
                        </ol>
                      ) : <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>}
                    </section>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
