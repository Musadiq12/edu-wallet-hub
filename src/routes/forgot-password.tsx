import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/config/site";
import { friendlyError } from "@/lib/admin";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: `Reset password — ${siteConfig.fallbackBrand.brandName}` },
      { name: "description", content: "Reset the password for your Edu Wallet account." },
      { property: "og:title", content: `Reset password — ${siteConfig.fallbackBrand.brandName}` },
      { property: "og:description", content: "Reset your Edu Wallet password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
    setBusy(false);

    if (error) {
      toast.error(friendlyError(error, "Could not send the reset code."));
      return;
    }

    setSent(true);
    toast.success("Reset code sent. Check your email.");
    void navigate({
      to: "/reset-password",
      search: { email: normalizedEmail },
    });
  };

  return (
    <div className="page-container section-y max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      {sent ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm">
          <p>A 6-digit reset code has been sent to your email address.</p>
          <p className="mt-1 text-muted-foreground">Enter the code on the next screen to choose a new password.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset code"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link to="/login" className="text-primary hover:underline">Back to login</Link>
      </p>
    </div>
  );
}
