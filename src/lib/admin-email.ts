export const emailEvents = {
  seller_application_approved: { label: "Application approved", subject: "Your EduWallet seller application is approved", copy: "Your seller application has been approved. You can now access your seller workspace." },
  seller_application_rejected: { label: "Application rejected", subject: "Update on your EduWallet seller application", copy: "Your seller application could not be approved. Please review the reason below before updating and resubmitting your application." },
  seller_suspended: { label: "Seller suspended", subject: "Your EduWallet seller account is suspended", copy: "Your seller account has been suspended. Please review the reason below and contact support if you need clarification." },
  seller_reactivated: { label: "Seller reactivated", subject: "Your EduWallet seller account is active again", copy: "Your seller account has been reactivated. You can access your seller workspace again." },
  withdrawal_paid: { label: "Withdrawal paid", subject: "Your EduWallet payout has been completed", copy: "Your withdrawal has been marked paid following the manual transfer. The payout details are included below." },
  withdrawal_rejected: { label: "Withdrawal rejected", subject: "Update on your EduWallet withdrawal request", copy: "Your withdrawal request has been rejected. Please review the reason below and contact support if you need clarification." },
  seller_product_approved: { label: "Product approved", subject: "Your EduWallet product is approved", copy: "Your product has been approved." },
  seller_product_rejected: { label: "Product rejected", subject: "Update on your EduWallet product", copy: "Your product could not be approved. Please review the reason below." },
  sale_verified: { label: "Sale verified", subject: "Your EduWallet sale has been verified", copy: "The payment for your sale has been verified. The sale details are included below." },
  custom: { label: "Custom operational message", subject: "A message from EduWallet Support", copy: "" },
} as const;
export type EmailEvent = keyof typeof emailEvents;
export type EmailDetails = Record<string, string | number | null>;
export type EmailDraft = {
  eventType: EmailEvent; referenceId: string; recipientUserId?: string;
  recipientEmail?: string | null; recipientName?: string | null;
  details?: EmailDetails; reason?: string | null;
};
// Only these explicit operational fields can enter email payloads; never spread a database row.
const allowedDetails = new Set(["Application ID", "Seller ID", "Withdrawal ID", "Product ID", "Order ID", "Name", "Profession", "Education", "Exams", "Status", "Reason", "Amount", "Requested", "UPI ID", "UPI reference", "Product"]);
export function safeEmailDetails(details: EmailDetails = {}): EmailDetails {
  return Object.fromEntries(Object.entries(details).filter(([key, value]) => allowedDetails.has(key) && (value === null || typeof value === "string" || (typeof value === "number" && Number.isFinite(value)))));
}
export function emailIdempotencyKey(draft: Pick<EmailDraft, "eventType" | "referenceId">) {
  if (!draft.referenceId.trim()) throw new Error("A record reference is required.");
  return `admin-email:${draft.eventType}:${draft.referenceId}`;
}
export function prefillEmail(draft: EmailDraft) {
  const name = draft.recipientName?.trim() || "Seller";
  const reason = draft.reason?.trim();
  return { subject: emailEvents[draft.eventType].subject, message: draft.eventType === "custom" ? "" : `Dear ${name},\n\n${emailEvents[draft.eventType].copy}${reason ? `\n\nReason: ${reason}` : ""}\n\nKind regards,\nEduWallet Support` };
}
export function canSendWithdrawalEmail(status: string, event: EmailEvent) {
  return (event === "withdrawal_paid" && status === "paid") || (event === "withdrawal_rejected" && status === "rejected");
}
export function prepareEmailPayload(draft: EmailDraft, subject: string, message: string) {
  if (!subject.trim() || !message.trim()) throw new Error("Enter a subject and message before sending.");
  if (!draft.recipientUserId && !draft.recipientEmail?.trim()) throw new Error("Recipient email is unavailable.");
  if (["seller_application_rejected", "seller_suspended", "withdrawal_rejected", "seller_product_rejected"].includes(draft.eventType) && (!draft.reason?.trim() || !message.includes(draft.reason.trim()))) {
    throw new Error("Keep the exact decision reason in the email message.");
  }
  return {
    eventType: draft.eventType, referenceId: draft.referenceId,
    recipientUserId: draft.recipientUserId,
    // Let the function resolve the authoritative profile when a user ID exists.
    ...(!draft.recipientUserId ? { recipientEmail: draft.recipientEmail?.trim(), recipientName: draft.recipientName } : {}),
    subject: subject.trim(), message: message.trim(), details: safeEmailDetails(draft.details),
    idempotencyKey: emailIdempotencyKey(draft),
  };
}
export type EmailResult = { ok: true; recipient: string; subject: string; emailId: string };