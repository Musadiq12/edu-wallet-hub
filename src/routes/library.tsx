import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Layers3,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      { name: "description", content: "Manage your purchased Edu Wallet resources and track physical deliveries." },
      { property: "og:title", content: "My Library — Edu Wallet" },
      { property: "og:description", content: "Manage your purchased resources and track physical deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function getStatusLabel(status: PhysicalOrder["status"]) {
  if (status === "Payment Verified") return "Payment confirmed";
  return status;
}

function getStatusClasses(status: PhysicalOrder["status"]) {
  if (status === "Dispatched") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
  if (status === "Preparing Order") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300";
}

function LibraryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useSession();
  const [opening, setOpening] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPhysicalOrders = useMemo(() => {
    const items = physicalOrders.data ?? [];
    if (!normalizedSearch) return items;
    return items.filter((order) =>
      [order.product_title, order.order_id, order.status].some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [physicalOrders.data, normalizedSearch]);

  const filteredLibrary = useMemo(() => {
    const items = library.data ?? [];
    if (!normalizedSearch) return items;
    return items.filter((item) =>
      [item.title, item.description ?? "", item.format, item.slug].some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [library.data, normalizedSearch]);

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
    return (
      <div className="page-container space-y-5 py-12 sm:py-16">
        <Skeleton className="h-7 w-36 rounded-full" />
        <Skeleton className="h-12 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <div className="grid gap-4 pt-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const digitalCount = library.data?.length;
  const physicalCount = physicalOrders.data?.length;
  const hasAnyPurchase = (digitalCount ?? 0) > 0 || (physicalCount ?? 0) > 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20">
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <div className="page-container relative py-9 sm:py-12 lg:py-14">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5" />
                Your purchases, all in one place
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">My Library</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Pick up where you left off with digital resources, or follow the progress of your physical orders.
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/shop">
                Browse resources <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <main className="page-container pb-12">
        <section aria-label="Library overview" className="relative -mt-4 grid gap-3 sm:grid-cols-3">
          <article className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Digital resources</p>
              <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-foreground">
                {digitalCount ?? (library.isLoading ? "—" : "0")}
              </p>
            </div>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">Purchased</span>
          </article>
          <article className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <Truck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Physical orders</p>
              <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-foreground">
                {physicalCount ?? (physicalOrders.isLoading ? "—" : "0")}
              </p>
            </div>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">Trackable</span>
          </article>
          <article className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Your access</p>
              <p className="mt-1 text-lg font-bold leading-none tracking-tight text-foreground">Secure</p>
            </div>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">Private links</span>
          </article>
        </section>

        <section className="mt-8 sm:mt-10" aria-label="Search purchases">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Your purchases</h2>
              <p className="mt-1 text-sm text-muted-foreground">Search by resource name, order number, or delivery status.</p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your library…"
                aria-label="Search your purchases"
                className="h-10 rounded-xl border-border bg-card pl-9 pr-10"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {(physicalOrders.isLoading || physicalOrders.isError || (physicalCount ?? 0) > 0) && (
          <section className="mt-7 sm:mt-8" aria-labelledby="physical-orders-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Truck className="h-4 w-4" />
                  Delivery centre
                </div>
                <h2 id="physical-orders-heading" className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">Physical orders</h2>
                <p className="mt-1 text-sm text-muted-foreground">Follow each verified order from confirmation to dispatch.</p>
              </div>
              {physicalCount != null && (
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {filteredPhysicalOrders.length} of {physicalCount} {physicalCount === 1 ? "order" : "orders"}
                </span>
              )}
            </div>

            {physicalOrders.isError ? (
              <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5 sm:p-6">
                <p className="font-semibold text-foreground">Physical orders couldn’t be loaded.</p>
                <p className="mt-1 text-sm text-muted-foreground">Your payment and order records are unchanged. Try loading the orders again.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void physicalOrders.refetch()}>Try again</Button>
              </div>
            ) : physicalOrders.isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-2xl" />)}
              </div>
            ) : filteredPhysicalOrders.length > 0 ? (
              <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredPhysicalOrders.map((order) => (
                  <article key={order.order_id} className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <PackageCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold leading-6 text-foreground">{order.product_title}</h3>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">Order #{order.order_id.slice(-8).toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(order.status)}`}>
                        {order.status === "Dispatched" ? <Truck className="h-3.5 w-3.5" /> : order.status === "Preparing Order" ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {getStatusLabel(order.status)}
                      </span>
                      <span className="text-base font-bold tracking-tight text-foreground">{formatPrice(Number(order.amount))}</span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="flex items-start gap-2.5 text-muted-foreground">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-xs">Order date</p>
                          <p className="mt-0.5 font-medium text-foreground">{formatDate(order.created_at)}</p>
                        </div>
                      </div>
                      {order.estimated_delivery && (
                        <div className="flex items-start gap-2.5 text-muted-foreground">
                          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="text-xs">Estimated delivery</p>
                            <p className="mt-0.5 font-medium text-foreground">{order.estimated_delivery}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button className="mt-5 w-full" asChild>
                      <Link to="/track-order/$orderId" params={{ orderId: order.order_id }}>
                        Track Delivery <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card p-7 text-center sm:p-10">
                <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 font-semibold text-foreground">No matching physical orders</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different product name, order number, or status.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>Clear search</Button>
              </div>
            )}
          </section>
        )}

        <section className="mt-8 sm:mt-10" aria-labelledby="digital-resources-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Layers3 className="h-4 w-4" />
                Read and study
              </div>
              <h2 id="digital-resources-heading" className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">Digital resources</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your purchased PDFs, ready whenever you need them.</p>
            </div>
            {digitalCount != null && (
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                {filteredLibrary.length} of {digitalCount} {digitalCount === 1 ? "resource" : "resources"}
              </span>
            )}
          </div>

          {library.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-80 rounded-2xl" />)}
            </div>
          ) : library.isError ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5 sm:p-6">
              <p className="font-semibold text-foreground">Your digital resources couldn’t be loaded.</p>
              <p className="mt-1 text-sm text-muted-foreground">Refresh this section to retry. Your purchases have not been affected.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void library.refetch()}>Try again</Button>
            </div>
          ) : filteredLibrary.length > 0 ? (
            <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredLibrary.map((item) => (
                <article key={item.order_id} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                  <div className="relative h-44 shrink-0 overflow-hidden border-b border-border bg-muted sm:h-48">
                    <CoverImage path={item.cover_image} title={item.title} className="h-full border-0 transition-transform duration-300 group-hover:scale-[1.02]" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm">
                      <FileText className="h-3.5 w-3.5" /> {item.format}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold leading-6 text-foreground">{item.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.page_count ? `${item.page_count} pages` : item.format}
                          {item.verified_at ? ` · Purchased ${formatDate(item.verified_at)}` : ""}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Owned
                      </span>
                    </div>

                    {item.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.description}</p>}

                    <div className="mt-auto pt-5">
                      <div className="mb-4 flex items-center justify-between border-t border-border pt-4">
                        <span className="text-xs text-muted-foreground">Paid</span>
                        <span className="font-semibold text-foreground">{formatPrice(Number(item.amount))}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button className="min-w-0 flex-1" size="sm" disabled={opening === item.product_id} onClick={() => void openDocument(item)}>
                          <FileText className="mr-1.5 h-4 w-4" /> {opening === item.product_id ? "Opening…" : "Open resource"}
                        </Button>
                        <Button className="h-9 w-10 shrink-0 px-0" variant="outline" size="sm" aria-label={`Download ${item.title}`} title={`Download ${item.title}`} disabled={opening === item.product_id} onClick={() => void openDocument(item)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" /> Secure, account-specific access
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : normalizedSearch ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <h3 className="mt-3 font-semibold text-foreground">No resources match your search</h3>
              <p className="mt-1 text-sm text-muted-foreground">Try another title or clear your search to see all purchased resources.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>Clear search</Button>
            </div>
          ) : (physicalCount ?? 0) > 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <BookOpen className="mx-auto h-9 w-9 text-muted-foreground/50" />
              <h3 className="mt-3 font-semibold text-foreground">No digital resources yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Your physical orders are listed above. Purchased PDFs will appear here after payment is verified.</p>
              <Button className="mt-4" asChild><Link to="/shop">Browse resources</Link></Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center sm:px-10">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <BookOpen className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Your library is ready for its first purchase</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Once your payment is verified, digital resources will appear here and physical orders will get their own delivery tracker.
              </p>
              <Button className="mt-5" asChild><Link to="/shop">Explore the shop <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          )}
        </section>

        {!hasAnyPurchase && !library.isLoading && !physicalOrders.isLoading && !library.isError && !physicalOrders.isError && (
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> This private library is visible only to your account.
          </p>
        )}
      </main>
    </div>
  );
}
