import { supabase } from "@/integrations/supabase/client";
import { prepareEmailPayload, type EmailDraft, type EmailResult } from "./admin-email";

export async function sendAdminEmail(draft: EmailDraft, subject: string, message: string): Promise<EmailResult> {
  const payload = prepareEmailPayload(draft, subject, message);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  // The existing client fetch supplies apikey; explicitly attach the current user bearer.
  const { data, error } = await supabase.functions.invoke("admin-send-notification", {
    body: payload, headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });
  if (error) {
    const context = "context" in error ? error.context : undefined;
    if (context instanceof Response) {
      throw new Error(`Email was not confirmed (HTTP ${context.status}). Check the email service and retry; the decision is unchanged.`);
    }
    throw new Error("Email was not confirmed. Check your connection and retry; the decision is unchanged.");
  }
  if (!data?.ok || typeof data.emailId !== "string" || typeof data.recipient !== "string" || typeof data.subject !== "string") {
    throw new Error("The email service did not confirm sending. Retry with the same reference.");
  }
  return data as EmailResult;
}