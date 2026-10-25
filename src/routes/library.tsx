import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Download, FileText, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverImage } from "@/components/CoverImage";
import { useSession } from "@/lib/auth";
import { signedUrl } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

type LibraryItem = {
  product_id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
  pdf_file: string;
  page_count: number | null;
  format: string;
  order_id: string;
  amount: number | string;
  verified_at: string | null;
  delivered_at: string | null;
};

type PhysicalOrder = {
  order_id: string;
  product_title: string;
  amount: number | string;
  created_at: string;
  status: "Payment Verified" | "Preparing Order" | "Dispatched";
  estimated_delivery: string | null;
};

const physicalOrdersRpc = supabase as unknown as {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "My Library — Edu Wallet" },
      { name: "description", content: "Access your purchased Edu Wallet study resources." },
      { property: "og:title", content: "My Library — Edu Wallet" },
      { property: "og:description", content: "Access your purchased Edu Wallet study resources." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useSession();
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      void navigate({ to: "/login", search: { redirect: "/library" } });
    }
  }, [authLoading, user, navigate]);

  const physicalOrders = useQuery({
    queryKey: ["my-physical-orders", user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<PhysicalOrder[]> => {
      const { data, error } = await physicalOrdersRpc.rpc("get_my_physical_orders", {});
      if (error) throw error;

      if (!Array.isArray(data)) return [];
      return data.flatMap((value): PhysicalOrder[] => {
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>;
        if (
          typeof row.order_id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(row.order_id) ||
          typeof row.product_title !== "string" ||
          typeof row.created_at !== "string" ||
          !["Payment Verified", "Preparing Order", "Dispatched"].includes(String(row.status)) ||
          !(typeof row.amount === "number" || typeof row.amount === "string")
        ) {
          return [];
        }

        return [{
          order_id: row.order_id,
          product_title: row.product_title,
          amount: row.amount,
          created_at: row.created_at,
          status: row.status as PhysicalOrder["status"],
          estimated_delivery: typeof row.estimated_delivery === "string" ? row.estimated_delivery : null,
        }];
      });
    },
  });

  const library = useQuery({
    queryKey: ["my-library", user?.id],
    refetchOnWindowFocus: true,
    enabled: !!user,
    queryFn: async (): Promise<LibraryItem[]> => {
      const { data, error } = await supabase
        .from("my_library")
        .select("product_id,title,slug,description,cover_image,pdf_file,page_count,format,order_id,amount,verified_at,delivered_at")
        .order("verified_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).flatMap((row) => {
        if (!row.product_id || !row.title || !row.slug || !row.pdf_file || !row.order_id) return [];
        return [{
          product_id: row.product_id,
          title: row.title,
          slug: row.slug,
          description: row.description,
          cover_image: row.cover_image,
          pdf_file: row.pdf_file,
          page_count: row.page_count,
          format: row.format ?? "PDF",
          order_id: row.order_id,
          amount: row.amount ?? 0,
          verified_at: row.verified_at,
          delivered_at: row.delivered_at,
        }];
      });
    },
  });

  const openDocument = async (item: LibraryItem) => {
    setOpening(item.product_id);

    try {
      let url: string | null = null;

      if (item.pdf_file.startsWith("products/")) {
        const workerUrl = String(
          import.meta.env["VITE_R2_WORKER_URL"] ||
            "https://edu-wallet-r2.designeroutletmedia.workers.dev",
        ).replace(/\/$/, "");

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Your session has expired. Please sign in again.");

        const response = await fetch(`${workerUrl}/customer-delivery-link`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: item.pdf_file,
            expiresIn: 30 * 60,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || typeof data?.url !== "string") {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : `Secure document request failed (HTTP ${response.status}).`,
          );
        }

        url = data.url;
      } else {
        url = await signedUrl("product-files", item.pdf_file, 30 * 60);
      }

      if (!url) throw new Error("Could not create a secure document link.");

      window.location.assign(url);
    } catch (error) {
      console.error("[Library] Document open failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message);
    } finally {
      setOpening(null);
    }
  };

  if (authLoading || !user) {
    return <div className="page-container py-16"><Skeleton className="h-10 w-64" /><Skeleton className="mt-6 h-32 w-full" /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <section className="border-b border-border bg-surface">
        <div className="page-container py-10 sm:py-14">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Your account</p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">My Library</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Your verified purchases appear below. Track physical deliveries and open your digital PDFs securely from this library.
              </p>
            </div>
            <div className="hidden rounded-xl border border-border bg-card p-3 sm:block">
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
          </div>
        </div>
      </section>

      {physicalOrders.isLoading || physicalOrders.isError || (physicalOrders.data?.length ?? 0) > 0 ? (
        <section className="page-container pt-8">
          {physicalOrders.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <p className="font-medium">Your physical orders could not be loaded.</p>
              <p className="mt-1 text-sm text-muted-foreground">Refresh this section to try again. Your payment and order records are unchanged.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void physicalOrders.refetch()}>Try again</Button>
            </div>
          ) : physicalOrders.isLoading ? (
            <Skeleton className="h-36 w-full rounded-xl" />
          ) : (
            <>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Physical orders</p>
                <h2 className="mt-1 text-xl font-semibold">Track your deliveries</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tracking is shown only for physical purchases verified on your account.</p>
              </div>
              <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {physicalOrders.data?.map((order) => (
                  <article key={order.order_id} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 text-card-foreground transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold leading-6">{order.product_title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Order #{order.order_id.slice(-8).toUpperCase()}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">Purchased</span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <PackageCheck className="h-4 w-4 shrink-0" />
                        <span>{order.status === "Payment Verified" ? "Payment Confirmed" : order.status}</span>
                      </p>
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <CalendarDays className="h-4 w-4 shrink-0" />
                        <span>{new Date(order.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                      </p>
                      <p className="font-semibold text-foreground">{formatPrice(Number(order.amount))}</p>
                      {order.estimated_delivery && (
                        <p className="text-xs text-muted-foreground">Estimated delivery: {order.estimated_delivery}</p>
                      )}
                    </div>
                    <Button className="mt-auto w-full" size="sm" asChild>
                      <Link to="/track-order/$orderId" params={{ orderId: order.order_id }}>
                        <Truck className="mr-2 h-4 w-4" />Track Delivery
                      </Link>
                    </Button>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}

      <section className="page-container py-10">
        {library.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : library.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <p className="font-medium">Your library could not be loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">Please refresh the page. Your purchases have not been affected.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void library.refetch()}>Try again</Button>
          </div>
        ) : library.data?.length ? (
          <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {library.data.map((item) => (
              <article key={item.order_id} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-shadow hover:shadow-md">
                <div className="h-36 shrink-0 overflow-hidden border-b border-border bg-surface">
                  <CoverImage path={item.cover_image} title={item.title} className="h-full border-0" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words font-semibold leading-6">{item.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{item.format}{item.page_count ? ` · ${item.page_count} pages` : ""}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">Purchased</span>
                  </div>
                  {item.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
                  <div className="mt-auto flex gap-2 pt-5">
                    <Button className="min-w-0 flex-1" size="sm" disabled={opening === item.product_id} onClick={() => void openDocument(item)}>
                      <FileText className="mr-1.5 h-4 w-4" /> {opening === item.product_id ? "Opening…" : "View PDF"}
                    </Button>
                    <Button className="h-8 w-8 shrink-0 px-0" variant="outline" size="sm" aria-label={`Download ${item.title}`} title={`Download ${item.title}`} disabled={opening === item.product_id} onClick={() => void openDocument(item)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">Secure link generated for your account.</p>
                </div>
              </article>
            ))}
          </div>
        ) : physicalOrders.data?.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
            <BookOpen className="mx-auto h-9 w-9 text-muted-foreground/50" />
            <h2 className="mt-3 text-lg font-semibold">No digital resources yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Your physical orders are listed above. Purchased PDFs will appear here after payment is verified.
            </p>
            <Button className="mt-4" asChild><Link to="/shop">Browse resources</Link></Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">Your library is empty</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Once a purchase is verified, the resource will appear here automatically. You can continue receiving the delivery through WhatsApp too.
            </p>
            <Button className="mt-5" asChild><Link to="/shop">Browse resources</Link></Button>
          </div>
        )}
      </section>
    </div>
  );
}
