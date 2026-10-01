import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Download, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverImage } from "@/components/CoverImage";
import { useSession } from "@/lib/auth";
import { signedUrl } from "@/lib/catalog";
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

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "My Library — EduWallet" },
      { name: "description", content: "Access your purchased EduWallet study resources." },
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

  const library = useQuery({
    queryKey: ["my-library", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LibraryItem[]> => {
      const client = supabase as any;
      const { data, error } = await client
        .from("my_library")
        .select("product_id,title,slug,description,cover_image,pdf_file,page_count,format,order_id,amount,verified_at,delivered_at")
        .order("verified_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LibraryItem[];
    },
  });

  const openDocument = async (item: LibraryItem) => {
    setOpening(item.product_id);

    try {
      let url: string | null = null;

      if (item.pdf_file.startsWith("products/")) {
        const workerUrl = String(
          import.meta.env.VITE_R2_WORKER_URL ||
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
                Your verified purchases stay available here. WhatsApp delivery remains available as a convenient backup.
              </p>
            </div>
            <div className="hidden rounded-xl border border-border bg-card p-3 sm:block">
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
          </div>
        </div>
      </section>

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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {library.data.map((item) => (
              <article key={item.order_id} className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
                <CoverImage path={item.cover_image} title={item.title} className="h-36" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold leading-6">{item.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{item.format}{item.page_count ? ` · ${item.page_count} pages` : ""}</p>
                    </div>
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">Purchased</span>
                  </div>
                  {item.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
                  <div className="mt-5 flex gap-2">
                    <Button className="flex-1" size="sm" disabled={opening === item.product_id} onClick={() => void openDocument(item)}>
                      <FileText className="mr-1.5 h-4 w-4" /> {opening === item.product_id ? "Opening…" : "View PDF"}
                    </Button>
                    <Button variant="outline" size="sm" aria-label={`Download ${item.title}`} disabled={opening === item.product_id} onClick={() => void openDocument(item)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">Secure link generated for your account.</p>
                </div>
              </article>
            ))}
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
