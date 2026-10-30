import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, Banknote, CheckCircle2, Clock3, IndianRupee, LockKeyhole, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { requestSellerWithdrawal, sellerWalletQuery, updateSellerUpi } from "@/lib/seller-wallet";

export const Route = createFileRoute("/seller/wallet")({ component: SellerWalletPage });
const money = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(v ?? 0));
const when = (v: string | null) => v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const statusText: Record<string,string> = { requested: "Requested", processing: "Processing", paid: "Paid", rejected: "Rejected" };
const statusClass: Record<string,string> = { requested: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200", processing: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200", paid: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200", rejected: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" };

function SellerWalletPage() {
  const qc = useQueryClient();
  const wallet = useQuery(sellerWalletQuery());
  const data = wallet.data;
  const [upi, setUpi] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const savedUpi = data?.upiId ?? "";
  const upiValue = upi ?? savedUpi;
  const summary = data?.summary;
  const metrics = [
    ["Lifetime net earnings", summary?.lifetime_earnings ?? 0, "Your share after recorded commission; excludes refunded orders"],
    ["Commission deducted", summary?.commission_deducted ?? 0, "Recorded separately against verified sales"],
    ["Pending release", summary?.pending_balance ?? 0, "Waiting for release under the current payout policy"],
    ["Pending withdrawals", summary?.pending_withdrawals ?? 0, "Amounts reserved for open withdrawal requests"],
  ] as const;
  const saveMutation = useMutation({
    mutationFn: (value: string) => updateSellerUpi(value),
    onSuccess: async () => { setUpi(null); await qc.invalidateQueries({ queryKey: ["seller", "wallet"] }); toast.success("UPI ID updated."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const requestMutation = useMutation({
    mutationFn: (value: number) => requestSellerWithdrawal(value),
    onSuccess: async () => { setAmount(""); await qc.invalidateQueries({ queryKey: ["seller", "wallet"] }); toast.success("Withdrawal request submitted. EduWallet will process the manual UPI payout within 24 hours."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const submitWithdrawal = async () => {
    if (requestMutation.isPending || !amount.trim()) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || Math.round(value * 100) !== value * 100) {
      toast.error("Enter an amount greater than ₹0, with up to two decimal places."); return;
    }
    if (value > Number(summary?.withdrawable_balance ?? 0)) {
      toast.error("The amount is higher than your current withdrawable balance."); return;
    }
    if (!upiValue.trim()) {
      toast.error("Add and save a payout UPI ID before requesting a withdrawal."); return;
    }
    await requestMutation.mutateAsync(value);
  };
  return <SellerRouteGuard><SellerLayout>
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold tracking-tight sm:text-2xl">Wallet & withdrawals</h2><p className="mt-1 text-sm text-muted-foreground">See how earnings are calculated, when they become available, and the status of every payout request.</p></div><Badge variant="outline" className="w-fit gap-1.5 border-emerald-300 bg-emerald-50 px-3 py-1.5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><ShieldCheck className="size-4"/> Seller wallet ledger</Badge></section>
    {wallet.isError && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">We couldn't load your wallet. Your balance and payout records have not been changed. Refresh to try again.</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Wallet summary">
      {metrics.map(([label, value, help]) => <Card key={label} className="rounded-2xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums">{wallet.isLoading ? <Skeleton className="h-8 w-28" /> : money(Number(value))}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{help}</p></CardContent></Card>)}
    </section>
    <Card className="overflow-hidden rounded-2xl border-emerald-200 shadow-sm dark:border-emerald-900">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
        <div className="bg-gradient-to-br from-emerald-50 to-white p-5 dark:from-emerald-950/40 dark:to-card sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100"><Wallet className="size-4"/> Available to withdraw</p>
          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-emerald-950 dark:text-emerald-100">{wallet.isLoading ? <Skeleton className="h-10 w-40" /> : money(summary?.withdrawable_balance ?? 0)}</p>
          <p className="mt-2 max-w-lg text-xs leading-5 text-muted-foreground">This is the amount currently eligible for a withdrawal request after the active payout policy and all requested, processing, and paid withdrawals are accounted for.</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200"><LockKeyhole className="size-4"/> Your balance is calculated by the seller wallet ledger.</div>
        </div>
        <div className="space-y-3 border-t border-border p-5 lg:border-l lg:border-t-0 sm:p-6">
          <div><Label htmlFor="withdraw-amount">Withdrawal amount (₹)</Label><Input id="withdraw-amount" className="mt-1.5 h-11 text-base tabular-nums" inputMode="decimal" type="number" min="0.01" step="0.01" max={summary?.withdrawable_balance ?? 0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" disabled={requestMutation.isPending} /><p className="mt-1 text-xs text-muted-foreground">Maximum: {wallet.isLoading?"—":money(summary?.withdrawable_balance??0)}</p></div>
          <Button className="h-11 w-full" onClick={() => void submitWithdrawal()} disabled={requestMutation.isPending || wallet.isLoading || Number(summary?.withdrawable_balance ?? 0) <= 0 || !upiValue.trim()}>{requestMutation.isPending ? "Submitting request…" : <><ArrowDownToLine className="mr-2 size-4"/> Request withdrawal</>}</Button>
          {!upiValue.trim()&&<p className="text-xs text-amber-700 dark:text-amber-300">Save a UPI ID below to enable withdrawal requests.</p>}
        </div>
      </div>
    </Card>
    <Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Understand your payout timeline</CardTitle><p className="text-sm text-muted-foreground">A sale and a payout request have separate timelines.</p></CardHeader><CardContent>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Sale verified","Your seller share is recorded after payment verification."],
          ["Earnings available","Verified sale earnings become available according to the current payout policy."],
          ["Withdrawal request","Submit a request for any amount within your available balance."],
          ["Manual UPI payout","EduWallet transfers the amount to your saved UPI ID within 24 hours."],
          ["Marked paid","The admin marks the request Paid after completing the transfer."],
        ].map(([label,detail],i)=><li key={label} className="rounded-xl border border-border bg-muted/30 p-3"><span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i+1}</span><p className="mt-2 text-sm font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></li>)}
      </ol>
      <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">The seven-day hold and ₹500 minimum reserve are controlled independently by EduWallet administrators. Withdrawal payments are manual UPI transfers: submit a request, receive payment within 24 hours, and see it marked Paid after the transfer is completed.</p>
    </CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Banknote className="size-5"/> Payout UPI ID</CardTitle><p className="text-sm text-muted-foreground">EduWallet uses this saved UPI ID as the destination for manual payouts.</p></CardHeader><CardContent className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="seller-upi">UPI ID</Label><Input id="seller-upi" className="h-11" value={upiValue} onChange={e => setUpi(e.target.value)} placeholder="name@bank" autoComplete="off" maxLength={100} /><p className="text-xs leading-5 text-muted-foreground">Example: yourname@upi. Check every character before saving. The destination is copied into each withdrawal request.</p></div>
        <Button variant="outline" className="w-full" disabled={saveMutation.isPending || !upiValue.trim() || upiValue.trim().toLowerCase() === savedUpi.toLowerCase()} onClick={() => saveMutation.mutate(upiValue)}>{saveMutation.isPending ? "Saving UPI ID…" : "Save UPI ID"}</Button>
      </CardContent></Card>
      <Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="size-5"/> Payout timing & status</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-3"><span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"><Clock3 className="size-4"/></span><div><p className="font-semibold">Requested</p><p className="text-xs leading-5 text-muted-foreground">Your request is recorded and the amount stays reserved while it is open.</p></div></div>
        <div className="flex items-start gap-3"><span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"><Banknote className="size-4"/></span><div><p className="font-semibold">Processing</p><p className="text-xs leading-5 text-muted-foreground">EduWallet is arranging the manual UPI transfer. The requested amount remains reserved.</p></div></div>
        <div className="flex items-start gap-3"><span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><CheckCircle2 className="size-4"/></span><div><p className="font-semibold">Paid</p><p className="text-xs leading-5 text-muted-foreground">The payout is marked paid. A UPI reference may be shown in your history.</p></div></div>
        <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">If a request is rejected, the reason appears in the history and the reserved amount is released back to your available balance.</div>
      </CardContent></Card>
    </div>
    <Card className="rounded-2xl shadow-sm"><CardHeader><CardTitle className="text-base">Withdrawal history</CardTitle><p className="text-sm text-muted-foreground">Every request and status change stays visible for your records.</p></CardHeader><CardContent>
      {wallet.isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      : !data?.withdrawals.length ? <div className="rounded-xl border border-dashed p-8 text-center"><IndianRupee className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 font-semibold">No withdrawals yet</p><p className="mt-1 text-sm text-muted-foreground">When you request a payout, the amount, destination UPI ID, and status history will appear here.</p></div>
      : <div className="divide-y divide-border">{data.withdrawals.map(row => <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold tabular-nums">{money(Number(row.amount))}</p><Badge variant="outline" className={statusClass[row.status] ?? ""}>{statusText[row.status] ?? row.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Requested {when(row.requested_at)} · UPI destination: {row.upi_id ?? "Not recorded"}</p>{row.processing_at && <p className="mt-1 text-xs text-muted-foreground">Processing started {when(row.processing_at)}</p>}{row.paid_at && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Marked paid {when(row.paid_at)}{row.upi_reference ? " · UPI reference: " + row.upi_reference : ""}</p>}{row.rejected_at && <p className="mt-1 text-xs text-muted-foreground">Rejected {when(row.rejected_at)}</p>}{row.rejection_reason && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-800 dark:bg-red-950/40 dark:text-red-200">Reason: {row.rejection_reason}</p>}</div><p className="text-[11px] text-muted-foreground">Request ID {row.id.slice(0,8).toUpperCase()}</p></div>)}</div>}
    </CardContent></Card>
  </SellerLayout></SellerRouteGuard>;
}
