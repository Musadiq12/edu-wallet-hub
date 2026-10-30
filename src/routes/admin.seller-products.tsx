import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, FileText, Loader2, RefreshCw, Save, Search, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getSellerProductReview, listSellerProductReviews, reviewSellerProduct } from "@/lib/seller-product-review.server-fns";

export const Route = createFileRoute("/admin/seller-products")({ component: SellerProductReviewPage });

type QueueRow = {
  id: string; title: string; slug: string; course_label: string | null; subject_label: string | null;
  price: number | string; status: "pending" | "published" | "rejected" | "unpublished";
  submitted_at: string | null; revision_of: string | null; seller_id: string; seller_name?: string; created_at: string;
  category_id: string | null;
};
type Detail = QueueRow & {
  description: string | null; whats_included: string | null; pdf_file: string | null; preview_file: string | null;
  seller_name: string; seller_email: string | null; seller_joined_at: string | null;
  seller_total_products: number; seller_rejected_products: number; pdf_url: string | null; preview_url: string | null;
  rejection_reason: string | null; admin_notes: string | null; reviewed_at: string | null; published_at: string | null;
};
const reasonTemplates = ["Low quality scan","Copyright concern","Incomplete content","Incorrect or misleading description","Unreadable or corrupted PDF"];

function waitingLabel(value: string | null) {
  if (!value) return "Submission date unavailable";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000));
  if (hours < 1) return "Waiting less than an hour";
  if (hours < 24) return `Waiting ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Waiting ${days}d ${hours % 24}h`;
}
function money(value: number | string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
}

function SellerProductReviewPage() {
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [status, setStatus] = useState<"pending" | "published" | "rejected" | "unpublished">("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session?.access_token) {
        toast.error("Your admin session has expired. Sign in again.");
        return;
      }
      setToken(data.session.access_token);
    });
    return () => { active = false; };
  }, []);

  const queue = useQuery({
    queryKey: ["admin", "seller-product-review", status],
    enabled: !!token,
    queryFn: async () => listSellerProductReviews({ data: { accessToken: token, status } }) as unknown as QueueRow[],
    refetchInterval: 60000,
  });
  const detail = useQuery({
    queryKey: ["admin", "seller-product-review-detail", selectedId],
    enabled: !!token && !!selectedId,
    queryFn: async () => getSellerProductReview({ data: { accessToken: token, id: selectedId! } }) as unknown as Detail,
  });
  useEffect(() => { setNotes(detail.data?.admin_notes ?? ""); }, [detail.data?.id, detail.data?.admin_notes]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (queue.data ?? []).filter(row => (categoryFilter === "all" || (row.course_label ?? "Other") === categoryFilter) && (!term || row.title.toLowerCase().includes(term) || (row.seller_name ?? "").toLowerCase().includes(term)));
  }, [queue.data, search, categoryFilter]);

  const runAction = async (action: "approve" | "reject" | "unpublish" | "republish" | "save_notes", value?: string) => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      await reviewSellerProduct({ data: {
        accessToken: token, id: selectedId, action,
        ...(action === "reject" ? { reason: value } : {}),
        ...(action === "save_notes" ? { adminNotes: value ?? "" } : {}),
      } });
      toast.success(action === "save_notes" ? "Internal note saved." : action === "reject" ? "Product rejected. Seller notified." : action === "unpublish" ? "Product taken down. Seller notified." : "Product status updated. Seller notified.");
      setRejectOpen(false);
      setConfirmApprove(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "seller-product-review"] }),
        qc.invalidateQueries({ queryKey: ["admin", "seller-product-review-detail", selectedId] }),
        qc.invalidateQueries({ queryKey: ["seller", "products"] }),
        qc.invalidateQueries({ queryKey: ["seller", "notifications"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
      ]);
      if (action !== "save_notes") {
        if (action === "approve" || action === "reject") setStatus(action === "approve" ? "published" : "rejected");
        setSelectedId(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update product review.");
    } finally { setBusy(false); }
  };

  const selected = detail.data;
  const pendingCount = queue.data?.length ?? 0;
  const categories = useMemo(() => [...new Set((queue.data ?? []).map(row => row.course_label ?? "Other"))].sort(), [queue.data]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">Product Review</h1><Badge variant="secondary">{status === "pending" ? pendingCount : visible.length} {status}</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">Review seller-submitted PDFs here. Unreviewed listings are excluded from the public store and general product catalogue.</p>
      </div>
      <Button variant="outline" onClick={() => void queue.refetch()} disabled={queue.isFetching}><RefreshCw className={`mr-2 size-4 ${queue.isFetching ? "animate-spin" : ""}`}/>Refresh queue</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-4">
      {(["pending","published","rejected","unpublished"] as const).map((value) => <button key={value} type="button" onClick={() => { setStatus(value); setSelectedId(null); }} className={`rounded-xl border p-3 text-left transition-colors ${status === value ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"}`}>
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{value === "unpublished" ? "Taken down" : value}</span>
        <span className="mt-1 block text-xl font-semibold tabular-nums">{value === status ? (queue.data?.length ?? 0) : "—"}</span>
      </button>)}
    </div>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.5fr)]">
      <Card className="overflow-hidden shadow-none">
        <div className="border-b border-border p-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product or seller name" className="pl-9"/></div>
          <div className="mt-2 flex items-center gap-2"><span className="text-xs text-muted-foreground">Category</span><select value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)} className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"><option value="all">All categories</option>{categories.map(value=><option key={value} value={value}>{value}</option>)}</select></div>
          <p className="mt-2 text-xs text-muted-foreground">Oldest submissions appear first.</p>
        </div>
        <CardContent className="p-0">
          {queue.isLoading ? <div className="space-y-2 p-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-20 w-full"/>)}</div>
          : queue.isError ? <div className="p-5 text-sm text-destructive">Could not load the review queue. Refresh and try again.</div>
          : visible.length === 0 ? <div className="p-8 text-center"><FileText className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 text-sm font-medium">No products in this queue</p><p className="mt-1 text-xs text-muted-foreground">Choose another status or clear the search.</p></div>
          : <div className="max-h-[72vh] overflow-y-auto divide-y divide-border">{visible.map(row => <button type="button" key={row.id} onClick={() => setSelectedId(row.id)} className={`w-full p-4 text-left transition-colors hover:bg-muted/40 ${selectedId === row.id ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""}`}>
            <div className="flex items-start justify-between gap-2"><span className="min-w-0 truncate text-sm font-semibold">{row.title}</span><Badge variant={row.status === "pending" ? "secondary" : "outline"}>{row.revision_of ? "Revision" : row.status}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">{row.course_label ?? "Other"} · {row.subject_label ?? "General"} · {money(row.price)}</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="truncate">{row.seller_name ?? "Seller"}</span><span>{waitingLabel(row.submitted_at ?? row.created_at)}</span></div>
          </button>)}</div>}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-4">
        {!selectedId ? <Card className="border-dashed shadow-none"><CardContent className="py-16 text-center"><ShieldAlert className="mx-auto size-9 text-muted-foreground"/><h2 className="mt-3 font-semibold">Select a product to review</h2><p className="mt-1 text-sm text-muted-foreground">Product details and the secured PDF preview will appear here.</p></CardContent></Card>
        : detail.isLoading ? <Skeleton className="h-[36rem] w-full"/>
        : detail.isError || !selected ? <Card><CardContent className="p-6 text-sm text-destructive">Could not load this product. Select it again or refresh.</CardContent></Card>
        : <>
          <Card className="shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{selected.title}</h2><Badge variant="outline">{selected.status}</Badge>{selected.revision_of&&<Badge variant="secondary">Edit to live product</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{selected.course_label??"Other"} · {selected.subject_label??"General"} · Submitted {selected.submitted_at ? new Date(selected.submitted_at).toLocaleString("en-IN") : "date unavailable"}</p></div><p className="text-lg font-semibold">{money(selected.price)}</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{selected.description||"No description provided."}</p></div>
                <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seller</p><p className="mt-1 font-medium">{selected.seller_name}</p><p className="text-sm text-muted-foreground">{selected.seller_email??"Email unavailable"}</p><p className="mt-2 text-xs text-muted-foreground">Joined {selected.seller_joined_at ? new Date(selected.seller_joined_at).toLocaleDateString("en-IN") : "Unknown"} · {selected.seller_total_products} products · {selected.seller_rejected_products} rejected</p></div>
              </div>
              {selected.whats_included&&<div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What's included</p><p className="mt-1 whitespace-pre-wrap text-sm">{selected.whats_included}</p></div>}
              <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild disabled={!selected.pdf_url}><a href={selected.pdf_url??"#"} download target="_blank" rel="noreferrer"><ExternalLink className="mr-2 size-4"/>Download original PDF</a></Button>{selected.preview_url&&<Button variant="outline" size="sm" asChild><a href={selected.preview_url} target="_blank" rel="noreferrer">Open sample PDF</a></Button>}</div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">PDF document preview</h3><span className="text-xs text-muted-foreground">Private file · temporary admin URL</span></div>
              {selected.pdf_url ? <iframe title={`PDF preview: ${selected.title}`} src={`${selected.pdf_url}#toolbar=1&navpanes=1&view=FitH`} className="h-[70vh] min-h-[500px] w-full rounded-lg border border-border bg-muted" /> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No PDF file is attached.</div>}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="space-y-3 p-5">
              <div><h3 className="font-semibold">Internal admin note</h3><p className="text-xs text-muted-foreground">Private to administrators. Sellers cannot read this field.</p></div>
              <Textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={4000} rows={3} placeholder="Record an internal moderation note…"/>
              <div className="flex justify-end"><Button size="sm" variant="outline" disabled={busy} onClick={() => void runAction("save_notes",notes)}><Save className="mr-2 size-4"/>Save note</Button></div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-semibold">Review decision</p><p className="text-xs text-muted-foreground">Actions are validated by the database state machine and written to the audit log.</p></div>
              <div className="flex flex-wrap gap-2">
                {selected.status==="pending"&&<>
                  <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/5" disabled={busy} onClick={()=>setRejectOpen(true)}><X className="mr-1 size-4"/>Reject</Button>
                  <Button disabled={busy} onClick={()=>setConfirmApprove(true)}><Check className="mr-1 size-4"/>Approve & publish</Button>
                </>}
                {selected.status==="published"&&<Button variant="destructive" disabled={busy} onClick={()=>void runAction("unpublish")}>Take down</Button>}
                {selected.status==="unpublished"&&<Button disabled={busy} onClick={()=>void runAction("republish")}>Republish</Button>}
                {busy&&<Loader2 className="size-5 animate-spin self-center"/>}
              </div>
            </CardContent>
          </Card>
        </>}
      </div>
    </div>

    <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Approve and publish this product?</AlertDialogTitle><AlertDialogDescription>The listing will become visible in the public shop. The seller will receive an in-app notification.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event=>{event.preventDefault();void runAction("approve")}}>Approve & publish</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reject seller product</AlertDialogTitle><AlertDialogDescription>Give a clear reason of at least 10 characters. The seller will see it and can edit and resubmit.</AlertDialogDescription></AlertDialogHeader>
      <div className="space-y-3"><div className="flex flex-wrap gap-2">{reasonTemplates.map(template=><Button type="button" key={template} size="sm" variant="outline" onClick={()=>setReason(current=>current?current+` · ${template}`:template)}>{template}</Button>)}</div><Textarea value={reason} onChange={event=>setReason(event.target.value)} rows={4} maxLength={1000} placeholder="Explain what needs to change…"/><p className="text-xs text-muted-foreground">{reason.trim().length}/1000 characters (minimum 10)</p></div>
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy||reason.trim().length<10} onClick={event=>{event.preventDefault();void runAction("reject",reason)}}>Reject product</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
