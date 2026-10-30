import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, Clock3, IndianRupee, ShieldCheck, Wallet } from "lucide-react";
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
const statusText: Record<string,string> = { requested: "Pending", processing: "Approved / Processing", paid: "Paid", rejected: "Rejected" };
const statusClass: Record<string,string> = { requested: "border-amber-300 bg-amber-50 text-amber-800", processing: "border-blue-300 bg-blue-50 text-blue-800", paid: "border-emerald-300 bg-emerald-50 text-emerald-800", rejected: "border-red-300 bg-red-50 text-red-800" };

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
    ["Lifetime net earnings", summary?.lifetime_earnings ?? 0, "After commission; excludes refunded orders"],
    ["Commission deducted", summary?.commission_deducted ?? 0, "Captured separately on every verified order"],
    ["Pending release", summary?.pending_balance ?? 0, "Held for 7 days after payment verification"],
    ["Pending withdrawals", summary?.pending_withdrawals ?? 0, "Requested or processing"],
  ] as const;
  const saveMutation = useMutation({
    mutationFn: (value: string) => updateSellerUpi(value),
    onSuccess: async () => { setUpi(null); await qc.invalidateQueries({ queryKey: ["seller", "wallet"] }); toast.success("UPI ID updated."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const requestMutation = useMutation({
    mutationFn: (value: number) => requestSellerWithdrawal(value),
    onSuccess: async () => { setAmount(""); await qc.invalidateQueries({ queryKey: ["seller", "wallet"] }); toast.success("Withdrawal request submitted. Payment is due within 24 hours."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const submitWithdrawal = async () => {
    if (requestMutation.isPending || !amount.trim()) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || Math.round(value * 100) !== value * 100) {
      toast.error("Enter a valid amount with up to two decimal places."); return;
    }
    await requestMutation.mutateAsync(value);
  };
  return <SellerRouteGuard><SellerLayout>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-2xl font-semibold tracking-tight">Wallet & withdrawals</h2><p className="mt-1 text-sm text-muted-foreground">Track seller earnings and request manual UPI payouts.</p></div>
      <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3.5" /> ₹500 minimum reserve</Badge>
    </div>
    {wallet.isError && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Could not load wallet details. Refresh and try again.</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value, help]) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{wallet.isLoading ? <Skeleton className="h-8 w-28" /> : money(Number(value))}</div><p className="mt-1 text-xs text-muted-foreground">{help}</p></CardContent></Card>)}
    </div>
    <Card className="border-primary/20 shadow-sm">
      <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="size-5" /> Available to withdraw</CardTitle><p className="text-sm text-muted-foreground">Released earnings less the ₹500 reserve and all requested, processing, or paid withdrawals.</p></CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-3xl font-bold tabular-nums">{wallet.isLoading ? <Skeleton className="h-9 w-36" /> : money(summary?.withdrawable_balance ?? 0)}</p><p className="mt-1 text-xs text-muted-foreground">New sales become eligible after the existing 7-day hold.</p></div>
        <div className="flex w-full flex-col gap-2 sm:max-w-xs"><Label htmlFor="withdraw-amount">Withdrawal amount (₹)</Label><Input id="withdraw-amount" inputMode="decimal" type="number" min="0.01" step="0.01" max={summary?.withdrawable_balance ?? 0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" disabled={requestMutation.isPending} /><Button onClick={() => void submitWithdrawal()} disabled={requestMutation.isPending || wallet.isLoading || Number(summary?.withdrawable_balance ?? 0) <= 0 || !upiValue.trim()}>{requestMutation.isPending ? "Submitting…" : "Request withdrawal"}</Button></div>
      </CardContent>
    </Card>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="size-5" /> Payout UPI ID</CardTitle><p className="text-sm text-muted-foreground">Payouts are sent manually to this UPI ID. The destination is copied into each request.</p></CardHeader><CardContent className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="seller-upi">UPI ID</Label><Input id="seller-upi" value={upiValue} onChange={e => setUpi(e.target.value)} placeholder="name@bank" autoComplete="off" maxLength={100} /><p className="text-xs text-muted-foreground">Example: yourname@upi. Confirm it is correct before saving.</p></div>
        <Button variant="outline" className="w-full" disabled={saveMutation.isPending || !upiValue.trim() || upiValue.trim().toLowerCase() === savedUpi.toLowerCase()} onClick={() => saveMutation.mutate(upiValue)}>{saveMutation.isPending ? "Saving…" : "Save UPI ID"}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="size-5" /> Payout timing</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>After a request is submitted, EduWallet will pay manually to the saved UPI ID within 24 hours.</p><p>The request remains reserved while Pending or Approved / Processing. It is released only if rejected.</p><p>After payment, the request history will show Paid.</p></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Withdrawal history</CardTitle><p className="text-sm text-muted-foreground">Each status transition is time-stamped and kept for audit.</p></CardHeader><CardContent>
      {wallet.isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      : !data?.withdrawals.length ? <div className="rounded-lg border border-dashed p-8 text-center"><IndianRupee className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 font-medium">No withdrawals yet</p><p className="mt-1 text-sm text-muted-foreground">Your requests and payout history will appear here.</p></div>
      : <div className="divide-y divide-border">{data.withdrawals.map(row => <div key={row.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold tabular-nums">{money(Number(row.amount))}</p><Badge variant="outline" className={statusClass[row.status] ?? ""}>{statusText[row.status] ?? row.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Requested {when(row.requested_at)} · UPI: {row.upi_id ?? "—"}</p>{row.processing_at && <p className="text-xs text-muted-foreground">Processing {when(row.processing_at)}</p>}{row.paid_at && <p className="text-xs text-muted-foreground">Paid {when(row.paid_at)}{row.upi_reference ? " · UPI ref: " + row.upi_reference : ""}</p>}{row.rejected_at && <p className="text-xs text-muted-foreground">Rejected {when(row.rejected_at)}</p>}{row.rejection_reason && <p className="text-xs text-destructive">Reason: {row.rejection_reason}</p>}</div><p className="text-xs text-muted-foreground">ID {row.id.slice(0,8).toUpperCase()}</p></div>)}</div>}
    </CardContent></Card>
  </SellerLayout></SellerRouteGuard>;
}
