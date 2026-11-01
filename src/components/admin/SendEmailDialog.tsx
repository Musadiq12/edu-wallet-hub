import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth";
import { emailEvents, emailIdempotencyKey, prefillEmail, safeEmailDetails, type EmailDraft, type EmailResult } from "@/lib/admin-email";
import { sendAdminEmail } from "@/lib/admin-email-client";

type SendState = { status: "pending" | "sending" | "sent" | "failed"; result?: EmailResult; sentAt?: string; error?: string };
export function SendEmailDialog({ draft, label, disabled = false }: { draft: EmailDraft; label: string; disabled?: boolean }) {
  const id = useId();
  const { user } = useSession();
  const qc = useQueryClient();
  const historyKey = ["admin-email-history", user?.id, emailIdempotencyKey(draft)];
  const history = useQuery<SendState>({ queryKey: historyKey, queryFn: () => ({ status: "pending" }), enabled: false, staleTime: Infinity, gcTime: Infinity });
  const state = history.data ?? { status: "pending" };
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<string>(prefillEmail(draft).subject);
  const [message, setMessage] = useState(prefillEmail(draft).message);
  const sendingRef = useRef(false);
  const sending = state.status === "sending";
  const sent = state.status === "sent";
  const send = async () => {
    if (sendingRef.current || disabled || !user || sent || sending || qc.getQueryData<SendState>(historyKey)?.status === "sending" || qc.getQueryData<SendState>(historyKey)?.status === "sent") return;
    sendingRef.current = true;
    qc.setQueryData<SendState>(historyKey, { status: "sending" });
    try {
      const result = await sendAdminEmail(draft, subject, message);
      qc.setQueryData<SendState>(historyKey, { status: "sent", result, sentAt: new Date().toISOString() });
      toast.success(`Email sent to ${result.recipient}.`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not send email. Please retry.";
      qc.setQueryData<SendState>(historyKey, { status: "failed", error: text });
      toast.error(text);
    } finally { sendingRef.current = false; }
  };
  return <div className="min-w-0 space-y-1">
    <Button variant="outline" size="sm" disabled={disabled || !user || sending} onClick={() => { if (!sent) { const copy = prefillEmail(draft); setSubject(copy.subject); setMessage(copy.message); } setOpen(true); }}>
      {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : sent ? <CheckCircle2 className="mr-2 size-4" /> : <Mail className="mr-2 size-4" />}{sent ? "Email sent · View receipt" : label}
    </Button>
    <p className="text-xs text-muted-foreground" role="status">{sending ? "Sending…" : sent ? `Sent ${new Date(state.sentAt ?? "").toLocaleString("en-IN")}` : state.status === "failed" ? "Send failed · Retry available" : "Not sent"}</p>
    <Dialog open={open} onOpenChange={(value) => { if (!sending) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg">
        <DialogHeader><DialogTitle>{sent ? "Email receipt" : "Review email"}</DialogTitle><DialogDescription>{emailEvents[draft.eventType].label}</DialogDescription></DialogHeader>
        <dl className="grid gap-2 text-sm sm:grid-cols-2"><div className="min-w-0"><dt className="text-muted-foreground">Recipient</dt><dd className="break-words font-medium">{draft.recipientName || "Seller"}</dd><dd className="break-all">{state.result?.recipient || draft.recipientEmail || "Email resolved from seller profile"}</dd></div><div className="min-w-0"><dt className="text-muted-foreground">Reference</dt><dd className="break-all">{draft.referenceId}</dd></div></dl>
        {sent ? <div className="space-y-2 rounded-lg border border-border p-4 text-sm" role="status"><p className="font-medium">Sent successfully</p><p className="break-words">{state.result?.subject}</p><p className="break-all text-muted-foreground">Email ID: {state.result?.emailId}</p></div> : <>
          <div className="space-y-2"><Label htmlFor={`${id}-subject`}>Subject</Label><Input id={`${id}-subject`} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sending} maxLength={200} /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-message`}>Message</Label><Textarea id={`${id}-message`} value={message} onChange={(e) => setMessage(e.target.value)} disabled={sending} rows={7} maxLength={5000} /></div>
          <section className="space-y-3 border-t border-border pt-4" aria-label="Email content preview"><h3 className="text-sm font-semibold">Content preview</h3><p className="break-words font-medium">{subject}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message || "—"}</p><dl className="divide-y divide-border text-sm">{Object.entries(safeEmailDetails(draft.details)).map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 py-2"><dt className="break-words text-muted-foreground">{key}</dt><dd className="break-words">{value ?? "—"}</dd></div>)}</dl></section>
        </>}
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Close</Button>{!sent && <Button onClick={() => void send()} disabled={disabled || sending || !subject.trim() || !message.trim()}>{sending && <Loader2 className="mr-2 size-4 animate-spin" />}{sending ? "Sending…" : state.status === "failed" ? "Retry email" : "Send email"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}