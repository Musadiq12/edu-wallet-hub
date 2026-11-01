import { expect, mock, test } from "bun:test";
let token = "current-user-token";
let response = { data: { ok: true, recipient: "seller@example.com", subject: "Update", emailId: "email-1" }, error: null };
const invoke = mock(async () => response);
mock.module("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null }, error: null }) }, functions: { invoke } } }));
const { sendAdminEmail } = await import("./admin-email-client");
const draft = { eventType: "custom", referenceId: "seller-1", recipientUserId: "seller-1" };
test("invoke attaches current bearer and stable payload reference", async () => {
  await sendAdminEmail(draft, "Update", "Hello");
  expect(invoke).toHaveBeenLastCalledWith("admin-send-notification", { headers: { Authorization: "Bearer current-user-token" }, body: { eventType: "custom", referenceId: "seller-1", recipientUserId: "seller-1", subject: "Update", message: "Hello", details: {}, idempotencyKey: "admin-email:custom:seller-1" } });
});
test("expired session cannot send", async () => {
  token = null;
  await expect(sendAdminEmail(draft, "Update", "Hello")).rejects.toThrow("session has expired");
  token = "new-user-token";
});
test("failed or unconfirmed responses never count as sent", async () => {
  response = { data: { ok: false }, error: null };
  await expect(sendAdminEmail(draft, "Update", "Hello")).rejects.toThrow("did not confirm");
  response = { data: null, error: new Error("network failure") };
  await expect(sendAdminEmail(draft, "Update", "Hello")).rejects.toThrow("not confirmed");
});