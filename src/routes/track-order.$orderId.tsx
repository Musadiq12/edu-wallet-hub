import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink, PackageCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/track-order/$orderId")({
  head: () => ({
    meta: [
      { title: "Track order — EduWallet" },
      { name: "description", content: "Securely track your physical EduWallet order." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrackOrderPage,
});

type TrackingStatus = "Payment Verified" | "Preparing Order" | "Dispatched";
type TrackingResponse = {
  order: {
    id: string;
    product_title: string;
    amount: number | string;
    created_at: string;
    verified_at: string | null;
    status: string;
    delivery_address: string | null;
    estimated_delivery: string | null;
    courier_name: string | null;
    courier_tracking_id: string | null;
    courier_tracking_url: string | null;
    history: { status: TrackingStatus; timestamp: string }[];
  };
};

const STAGES: TrackingStatus[] = ["Payment Verified", "Preparing Order", "Dispatched"];
const LABELS: Record<TrackingStatus, string> = {
  "Payment Verified": "Payment Confirmed",
  "Preparing Order": "Preparing Order",
  Dispatched: "Dispatched",
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function TrackOrderPage() {
  const { orderId } = Route.useParams();
  const { user, loading: authLoading } = useSession();

  const tracking = useQuery({
    queryKey: ["physical-order-tracking", user?.id, orderId],
    enabled: !!user && /^[0-9a-f-]{36}$/i.test(orderId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<TrackingResponse["order"]> => {
      const { data, error } = await supabase.rpc("get_physical_order_tracking", { p_order_id: orderId });
      if (error) throw error;
      const payload = data as unknown as TrackingResponse;
      if (!payload?.order?.id) throw new Error("We couldn't find this verified physical order.");
      return payload.order;
    },
  });

  if (authLoading) {
    return <div className="page-container section-y space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-80 w-full" /></div>;
  }
  if (!user) {
    return (
      <div className="page-container section-y">
        <section className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-semibold">Sign in to track your order</h1>
          <p className="mt-2 text-sm text-muted-foreground">For your privacy, tracking is available only to the account that placed the order.</p>
          <Button className="mt-5" asChild><Link to="/login" search={{ redirect: `/track-order/${orderId}` }}>Sign in</Link></Button>
        </section>
      </div>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return <div className="page-container section-y"><section className="rounded-xl border border-border bg-card p-8"><h1 className="text-2xl font-semibold">Invalid order reference</h1><p className="mt-2 text-sm text-muted-foreground">Check the order tracking link and try again.</p></section></div>;
  }
  if (tracking.isLoading) {
    return <div className="page-container section-y space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-80 w-full" /></div>;
  }
  if (tracking.isError || !tracking.data) {
    return (
      <div className="page-container section-y">
        <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8">
          <h1 className="text-2xl font-semibold">Order tracking unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">This order could not be found for your account, or tracking is temporarily unavailable. Your order may still be processing.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void tracking.refetch()}>Retry</Button>
            <Button variant="outline" asChild><Link to="/contact">Contact support</Link></Button>
          </div>
        </section>
      </div>
    );
  }

  const order = tracking.data;
  const currentIndex = STAGES.indexOf(order.status as TrackingStatus);
  const isDispatched = order.status === "Dispatched";
  const statusTime = new Map(order.history.map((entry) => [entry.status, entry.timestamp]));
  if (order.verified_at && !statusTime.has("Payment Verified")) statusTime.set("Payment Verified", order.verified_at);
  const visibleStages = currentIndex < 0 ? [STAGES[0]] : STAGES.slice(0, currentIndex + 1);

  return (
    <div className="section-y">
      <div className="page-container max-w-4xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Order tracking</p>
          <h1 className="mt-2 text-3xl font-bold">Track your delivery</h1>
          <p className="mt-2 text-sm text-muted-foreground">Status is refreshed from the order record whenever you open or refresh this page.</p>
        </div>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-success/10 p-3"><PackageCheck className="h-6 w-6 text-success" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Order ID</p>
              <p className="break-all font-semibold">#{order.id}</p>
              <p className="mt-1 text-sm text-muted-foreground">{order.product_title}</p>
            </div>
            <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">{LABELS[(order.status as TrackingStatus)] ?? "Payment Confirmed"}</span>
          </div>
          <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Quantity</p><p className="mt-1 font-semibold">{order.quantity ?? 1}</p></div>\n            <div><p className="text-xs text-muted-foreground">Quantity</p><p className="mt-1 font-semibold">{order.quantity ?? 1}</p></div>\n            <div><p className="text-xs text-muted-foreground">Amount paid</p><p className="mt-1 font-semibold">{formatPrice(Number(order.amount))}</p></div>
            <div><p className="text-xs text-muted-foreground">Order date</p><p className="mt-1 font-semibold">{formatTimestamp(order.created_at) ?? "—"}</p></div>
            <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Shipping address</p><p className="mt-1 font-medium">{order.delivery_address || "Address unavailable"}</p></div>
            {order.estimated_delivery && <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Estimated delivery</p><p className="mt-1 font-semibold">{order.estimated_delivery}</p></div>}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Delivery progress</h2>
          <ol className="mt-6 space-y-0">
            {visibleStages.map((stage, index) => {
              const completed = index < currentIndex;
              const current = index === currentIndex;
              const stamp = statusTime.get(stage) ?? (stage === "Payment Verified" ? order.verified_at : null);
              return (
                <li key={stage} className="relative flex gap-4 pb-7 last:pb-0">
                  {index < visibleStages.length - 1 && <span className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px ${completed ? "bg-success" : "bg-border"}`} aria-hidden="true" />}
                  <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${completed ? "border-success bg-success text-success-foreground" : current ? "border-primary bg-primary/10 text-primary ring-4 ring-primary/10" : "border-border bg-muted text-muted-foreground"}`}>
                    {completed ? <CheckCircle2 className="h-5 w-5" /> : current ? <PackageCheck className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${current ? "text-foreground" : completed ? "text-foreground" : "text-muted-foreground"}`}>{LABELS[stage]}</p>
                    {stamp && <p className="mt-1 text-xs text-muted-foreground">{completed ? "Completed" : "Updated"} · {formatTimestamp(stamp)}</p>}
                    {current && <p className="mt-1 text-sm text-muted-foreground">{stage === "Payment Verified" ? "Your payment is confirmed. Your order is waiting to be prepared." : stage === "Preparing Order" ? "Your order is being prepared for dispatch." : "Your package has been dispatched."}</p>}
                  </div>
                  {current && <span className="mt-1 shrink-0 text-xs font-semibold text-primary">Current</span>}
                </li>
              );
            })}
          </ol>
        </section>

        {isDispatched && order.courier_name && order.courier_tracking_id && order.courier_tracking_url && (
          <section className="rounded-xl border border-success/30 bg-success/5 p-5 sm:p-7">
            <h2 className="text-lg font-semibold">Your order has been dispatched</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your order has been dispatched. Use the tracking link below to follow your package with our courier partner.</p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Courier partner</dt><dd className="mt-1 font-semibold">{order.courier_name}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Tracking ID / AWB</dt><dd className="mt-1 break-all font-semibold">{order.courier_tracking_id}</dd></div>
            </dl>
            <Button className="mt-5" asChild>
              <a href={order.courier_tracking_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Track on Courier Website</a>
            </Button>
          </section>
        )}

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
          <div><h2 className="font-semibold">Need help?</h2><p className="mt-1 text-sm text-muted-foreground">Contact support and include your order ID.</p></div>
          <Button variant="outline" asChild><Link to="/contact">Contact support</Link></Button>
        </section>
      </div>
    </div>
  );
}
