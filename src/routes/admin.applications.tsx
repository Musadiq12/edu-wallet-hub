import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Clock3, FileText, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  approveSellerApplication,
  assertSellerApplicationsAdmin,
  getPendingSellerApplicationCount,
  getSellerApplicationDetail,
  listSellerApplications,
  rejectSellerApplication,
} from "@/lib/seller-applications.server-fns";
import { useSession } from "@/lib/auth";
import { BRAND, buildTitle } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { SendEmailDialog } from "@/components/admin/SendEmailDialog";

type Status = "pending" | "approved" | "rejected";
type Application = {
  id: string; user_id: string; full_name: string; user_email: string | null;
  profession: string; education: string; exams: string[] | null; id_card_path: string | null;
  upi_id: string; status: Status; rejection_reason: string | null;
  created_at: string; reviewed_at?: string | null;
};
type Detail = Application & { id_card_url: string | null };

async function getSessionAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  return session.access_token;
}

export const Route = createFileRoute("/admin/applications")({
  head: () => ({ meta: [
    { title: buildTitle(["Seller Applications", "Admin", BRAND]) },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: SellerApplicationsAdmin,
});

const dateLabel = (value: string) => new Date(value).toLocaleString("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const statusStyles: Record<Status, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
};

function SellerApplicationsAdmin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [serverRoleChecked, setServerRoleChecked] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("pending");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<Application | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!user) {
      void navigate({ to: "/", replace: true });
      return;
    }
    setVerificationError(null);
    void (async () => {
      try {
        const accessToken = await getSessionAccessToken();
        const result = await assertSellerApplicationsAdmin({ data: { accessToken } });
        if (!active) return;
        if (!result.authorized) {
          void navigate({ to: "/", replace: true });
          return;
        }
        setServerRoleChecked(true);
      } catch (error) {
        if (!active) return;
        setVerificationError(error instanceof Error ? error.message : "Could not verify administrator access.");
      }
    })();
    return () => { active = false; };
  }, [loading, user, navigate]);

  const apps = useQuery({
    queryKey: ["admin", "seller-applications", status],
    queryFn: async () => listSellerApplications({ data: { status, accessToken: await getSessionAccessToken() } }),
    enabled: !!user && serverRoleChecked,
  });
  const pendingCount = useQuery({
    queryKey: ["admin", "seller-applications", "pending-count"],
    queryFn: async () => getPendingSellerApplicationCount({ data: { accessToken: await getSessionAccessToken() } }),
    enabled: !!user && serverRoleChecked,
  });
  const detail = useQuery({
    queryKey: ["admin", "seller-application-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) throw new Error("Select an application.");
      return getSellerApplicationDetail({ data: { id: selectedId, accessToken: await getSessionAccessToken() } });
    },
    enabled: !!user && serverRoleChecked && !!selectedId,
    staleTime: 4 * 60 * 1000,
  });
  const rows = (apps.data ?? []) as Application[];
  const visible = rows.filter((row) => [row.full_name, row.user_email ?? "", row.profession, row.education, row.upi_id]
    .some((value) => value.toLowerCase().includes(search.trim().toLowerCase())));

  const refreshLists = async () => {
    setApproveTarget(null);
    setRejectTarget(null);
    setReason("");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "seller-applications"] }),
      qc.invalidateQueries({ queryKey: ["admin", "seller-application-detail"] }),
    ]);
  };

  const approve = async () => {
    if (!approveTarget || busy) return;
    setBusy(true);
    try {
      await approveSellerApplication({ data: { id: approveTarget.id, accessToken: await getSessionAccessToken() } });
      await refreshLists();
      await Promise.all([apps.refetch(), pendingCount.refetch()]);
      toast.success("Seller application approved. The user is now a seller.");
    } catch (error) {
      await Promise.all([apps.refetch(), pendingCount.refetch()]);
      toast.error(error instanceof Error ? error.message : "Could not approve this application.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejectTarget || busy || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await rejectSellerApplication({ data: { id: rejectTarget.id, reason: reason.trim(), accessToken: await getSessionAccessToken() } });
      await refreshLists();
      await Promise.all([apps.refetch(), pendingCount.refetch()]);
      toast.success("Application rejected. The applicant can edit and resubmit.");
    } catch (error) {
      await Promise.all([apps.refetch(), pendingCount.refetch()]);
      toast.error(error instanceof Error ? error.message : "Could not reject this application.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || (!!user && !serverRoleChecked && !verificationError)) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-36 w-full" /><Skeleton className="h-20 w-full" /></div>;
  if (verificationError) return <div className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-card p-6"><h1 className="text-xl font-semibold">Could not verify administrator access</h1><p className="mt-2 text-sm text-muted-foreground">The server-side check failed, so application data remains locked. This is a configuration or verification error, not an application list.</p><p className="mt-3 rounded-lg bg-muted p-3 text-sm" role="alert">{verificationError}</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => { setVerificationError(null); setServerRoleChecked(false); void navigate({ to: "/admin/applications", replace: true }); }}>Retry</Button><Button variant="outline" asChild><Link to="/admin">Admin dashboard</Link></Button></div></div>;
  const current = detail.data as Detail | undefined;

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><ShieldCheck className="size-4" /> Admin workspace</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Seller applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review identity documents and approve eligible sellers.</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <Clock3 className="size-4 text-amber-600" /><span className="text-sm text-muted-foreground">Awaiting review</span><span className="text-lg font-semibold tabular-nums">{pendingCount.data ?? "—"}</span>
      </div>
    </div>

    {selectedId ? <section className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div><button type="button" onClick={() => setSelectedId(null)} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Back to applications</button>
          <h2 className="text-xl font-semibold">{current?.full_name ?? "Application details"}</h2>
          {current && <p className="mt-1 break-all text-sm text-muted-foreground">{current.user_email ?? "Email unavailable"} · Applied {dateLabel(current.created_at)}</p>}
        </div>
        {current && <Badge className={statusStyles[current.status]} variant="outline">{current.status}</Badge>}
      </div>

      {detail.isLoading ? <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div> : detail.isError || !current ? <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Could not load this application. Close the details and try again.</div> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Full name", current.full_name], ["Email", current.user_email ?? "—"],
            ["Profession", current.profession], ["Education / qualification", current.education],
            ["Exams", current.exams?.join(", ") || "—"], ["UPI ID", current.upi_id],
            ["Applied", dateLabel(current.created_at)], ["Reviewed", current.reviewed_at ? dateLabel(current.reviewed_at) : "Not reviewed"],
            ["Status", current.status], ["Rejection reason", current.rejection_reason || "—"],
          ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>)}
        </div>

        <section className="rounded-xl border border-border p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Identity document</h3><p className="mt-1 text-xs text-muted-foreground">Private file · temporary link expires after 5 minutes</p></div><FileText className="size-5 text-muted-foreground" /></div>
          {!current.id_card_path ? <p className="mt-4 text-sm text-muted-foreground">No ID card was attached.</p> : !current.id_card_url ? <p className="mt-4 text-sm text-destructive">Could not generate a temporary preview link. Reopen this application to try again.</p> : current.id_card_path.toLowerCase().endsWith(".pdf") ?
            <iframe title="Seller ID card PDF" src={current.id_card_url} className="mt-4 h-[65vh] min-h-80 w-full rounded-lg border border-border" />
            : <img src={current.id_card_url} alt="Seller identity document" className="mt-4 max-h-[65vh] w-full rounded-lg border border-border object-contain" />}
          {current.id_card_url && <a href={current.id_card_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">Open document in new tab</a>}
        </section>

        {current.status === "pending" && <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={busy} onClick={() => { setReason(""); setRejectTarget(current); }}><X className="mr-2 size-4" />Reject application</Button>
          <Button disabled={busy} onClick={() => setApproveTarget(current)}><Check className="mr-2 size-4" />Approve seller</Button>
        </div>}
        {current.status !== "pending" && <SendEmailDialog key={`${current.id}-${current.status}`} label={current.status === "approved" ? "Send approval email" : "Send rejection email"} disabled={busy} draft={{
          eventType: current.status === "approved" ? "seller_application_approved" : "seller_application_rejected",
          referenceId: current.id, recipientUserId: current.user_id, recipientEmail: current.user_email, recipientName: current.full_name,
          reason: current.status === "rejected" ? current.rejection_reason : null,
          details: { "Application ID": current.id, Name: current.full_name, Profession: current.profession, Education: current.education, Exams: current.exams?.join(", ") || null, Status: current.status, Reason: current.rejection_reason },
        }} />}
      </>}
    </section> : <>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">{(["pending", "approved", "rejected"] as const).map((tab) => <Button key={tab} size="sm" variant={status === tab ? "default" : "outline"} onClick={() => { setStatus(tab); setSelectedId(null); }} className="min-w-24 capitalize">{tab}{tab === "pending" && (pendingCount.data ?? 0) > 0 ? <span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">{pendingCount.data}</span> : null}</Button>)}</div>
        <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applications…" aria-label="Search applications" className="h-10 pl-9" /></div>
      </div>

      {apps.isLoading ? <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div> :
       apps.isError ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"><p>Could not load applications.</p><Button size="sm" variant="outline" className="mt-3" onClick={() => void apps.refetch()}>Retry</Button></div> :
       visible.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center"><div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted"><FileText className="size-5 text-muted-foreground" /></div><p className="mt-3 font-medium">No {status} applications</p><p className="mt-1 text-sm text-muted-foreground">{search ? "Try a different search." : "Applications will appear here when submitted."}</p></div> :
       <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[56rem] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Applicant","Profession / education","Exams","UPI ID","Applied","Status"].map((v)=><th key={v} className="px-4 py-3 font-medium">{v}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.id} className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30" onClick={() => setSelectedId(row.id)}><td className="px-4 py-3"><p className="font-semibold">{row.full_name}</p><p className="mt-0.5 break-all text-xs text-muted-foreground">{row.user_email ?? "Email unavailable"}</p></td><td className="px-4 py-3"><p>{row.profession}</p><p className="mt-0.5 text-xs text-muted-foreground">{row.education}</p></td><td className="px-4 py-3">{row.exams?.join(", ") || "—"}</td><td className="px-4 py-3">{row.upi_id}</td><td className="whitespace-nowrap px-4 py-3">{dateLabel(row.created_at)}</td><td className="px-4 py-3"><Badge className={statusStyles[row.status]} variant="outline">{row.status}</Badge></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-border md:hidden">{visible.map((row) => <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className="block w-full p-4 text-left transition-colors hover:bg-muted/30"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{row.full_name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{row.user_email ?? "Email unavailable"}</p></div><Badge className={statusStyles[row.status]} variant="outline">{row.status}</Badge></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Profession</p><p className="mt-1 break-words">{row.profession}</p></div><div><p className="text-xs text-muted-foreground">Applied</p><p className="mt-1">{new Date(row.created_at).toLocaleDateString("en-IN")}</p></div></div><p className="mt-3 text-xs text-primary">Open application details →</p></button>)}</div>
       </div>
      }
    </>}

    <AlertDialog open={!!approveTarget} onOpenChange={(open) => !open && !busy && setApproveTarget(null)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Approve this seller?</AlertDialogTitle><AlertDialogDescription>This will approve {approveTarget?.full_name ?? "this applicant"} and change their account role to seller. Confirm only after reviewing their details and identity document.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void approve(); }}>{busy ? <><Loader2 className="mr-2 size-4 animate-spin" />Approving…</> : "Confirm approval"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && !busy && setRejectTarget(null)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reject application</AlertDialogTitle><AlertDialogDescription>Provide a reason so the applicant knows what to correct before resubmitting.</AlertDialogDescription></AlertDialogHeader>
        <div className="space-y-2"><Label htmlFor="seller-rejection-reason">Rejection reason <span className="text-destructive">*</span></Label><Textarea id="seller-rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={4} placeholder="Explain why the application cannot be approved…" disabled={busy} /><p className="text-xs text-muted-foreground">{reason.trim().length}/1000 characters</p></div>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy || reason.trim().length < 3} onClick={(event) => { event.preventDefault(); void reject(); }}>{busy ? <><Loader2 className="mr-2 size-4 animate-spin" />Rejecting…</> : "Confirm rejection"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
