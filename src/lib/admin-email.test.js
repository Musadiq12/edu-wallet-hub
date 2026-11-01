import { describe, expect, test } from "bun:test";
import { canSendWithdrawalEmail, emailIdempotencyKey, prefillEmail, prepareEmailPayload, safeEmailDetails, type EmailDraft } from "./admin-email";
const draft: EmailDraft = { eventType: "seller_application_approved", referenceId: "application-123", recipientUserId: "seller-123", recipientName: "Ayesha", details: { Profession: "Teacher", Education: "B.Ed", Exams: "CSEET" } };
describe("manual admin email rules", () => {
  test("idempotency uses event and record, never edited message or random time", () => {
    expect(emailIdempotencyKey(draft)).toBe("admin-email:seller_application_approved:application-123");
    expect(prepareEmailPayload(draft, "Edited subject", "Edited message").idempotencyKey).toBe(emailIdempotencyKey(draft));
    expect(emailIdempotencyKey({ ...draft, eventType: "seller_application_rejected" })).not.toBe(emailIdempotencyKey(draft));
  });
  test("payout confirmation requires actually paid status", () => {
    for (const status of ["requested", "processing", "rejected"]) expect(canSendWithdrawalEmail(status, "withdrawal_paid")).toBe(false);
    expect(canSendWithdrawalEmail("paid", "withdrawal_paid")).toBe(true);
  });
  test("withdrawal rejection email requires rejected status", () => {
    expect(canSendWithdrawalEmail("paid", "withdrawal_rejected")).toBe(false);
    expect(canSendWithdrawalEmail("rejected", "withdrawal_rejected")).toBe(true);
  });
  test("rejection and suspension preserve exact required reason", () => {
    for (const eventType of ["seller_application_rejected", "seller_suspended", "withdrawal_rejected"] as const) {
      const rejected = { ...draft, eventType, reason: "Document is unreadable." };
      const copy = prefillEmail(rejected);
      expect(copy.message).toContain("Document is unreadable.");
      expect(() => prepareEmailPayload(rejected, copy.subject, "Reason omitted")).toThrow("exact decision reason");
    }
  });
  test("identity documents PAN and bank fields cannot enter details", () => {
    expect(safeEmailDetails({ "UPI ID": "seller@upi", "UPI reference": "UTR123", PAN: "private", bank_account: "private", id_card_url: "private", id_card_path: "private" })).toEqual({ "UPI ID": "seller@upi", "UPI reference": "UTR123" });
  });
  test("custom requires subject and nonempty message", () => {
    expect(() => prepareEmailPayload({ ...draft, eventType: "custom" }, "", "hello")).toThrow();
    expect(() => prepareEmailPayload({ ...draft, eventType: "custom" }, "Operations", " ")).toThrow();
  });
  test("recipient is authoritatively resolved by profile ID", () => {
    const payload = prepareEmailPayload({ ...draft, recipientEmail: "display@example.com" }, "Update", "Hello");
    expect(payload.recipientUserId).toBe("seller-123");
    expect("recipientEmail" in payload).toBe(false);
  });
  test("copy interpolates available name and preserves actual details", () => {
    const copy = prefillEmail(draft);
    expect(copy.message).toContain("Dear Ayesha,");
    expect(prepareEmailPayload(draft, copy.subject, copy.message).details).toEqual(draft.details);
  });
});