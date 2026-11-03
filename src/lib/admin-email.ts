export const emailEvents = {
  seller_application_approved: { label: "Application approved", subject: "Your EduWallet seller application has been approved", copy: "We have completed the review of your seller application and are pleased to confirm that it has been approved. Your seller workspace is now available." },
  seller_application_rejected: { label: "Application decision", subject: "An update on your EduWallet seller application", copy: "We have completed the review of your seller application. We are unable to approve it at this time. Please review the decision details below before submitting an updated application." },
  seller_suspended: { label: "Seller account suspended", subject: "Important: an update to your EduWallet seller account", copy: "Your seller account has been suspended. The reason for this action and any relevant details are provided below. Please contact our support team if you need clarification." },
  seller_reactivated: { label: "Seller account reactivated", subject: "Your EduWallet seller account is active again", copy: "Your seller account has been reactivated. You may now sign in and continue using your seller workspace." },
  withdrawal_paid: { label: "Payout confirmation", subject: "Your EduWallet withdrawal has been completed", copy: "We have recorded your withdrawal as paid following the manual transfer to your saved UPI ID. Please review the payout summary below and retain this email for your records." },
  withdrawal_rejected: { label: "Withdrawal decision", subject: "An update on your EduWallet withdrawal request", copy: "After reviewing your withdrawal request, we are unable to approve it. The reason is provided below. Please contact support if you believe this decision requires further review." },
  seller_product_approved: { label: "Product approved", subject: "Your EduWallet product has been approved", copy: "Your product has passed our review and is approved for publication on EduWallet. You can review its status in your seller workspace." },
  seller_product_rejected: { label: "Product review feedback", subject: "Action required: updates to your EduWallet product", copy: "Your product did not pass review in its current form. Please review the feedback below, make the requested changes, and resubmit it for review." },
  sale_verified: { label: "Sale payment verified", subject: "Payment verified: your EduWallet sale is confirmed", copy: "The customer's payment has been verified and the sale has been recorded in your seller account. The transaction summary is included below." },
  custom: { label: "Custom operational message", subject: "An important message from EduWallet Support", copy: "" },
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