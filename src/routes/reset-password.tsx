import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/config/site";
import { friendlyError } from "@/lib/admin";

const RECOVERY_FLAG = "edu-wallet-password-recovery";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: `Set a new password — ${siteConfig.fallbackBrand.brandName}` },
      { name: "description", content: "Choose a new password for your Edu Wallet account." },
      { property: "og:title", content: `Set a new password — ${siteConfig.fallbackBrand.brandName}` },
      { property: "og:description", content: "Choose a new Edu Wallet password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    const verifyRecovery = async () => {
      const hasRecoveryFlag = window.sessionStorage.getItem(RECOVERY_FLAG) === "1";
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      if (hasRecoveryFlag && data.session) {
        setReady(true);
      } else {
        setInvalidLink(true);
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        window.sessionStorage.setItem(RECOVERY_FLAG, "1");
        setInvalidLink(false);
        setReady(true);
      }

      if (event === "SIGNED_OUT") {
        setReady(false);
      }
    });

    void verifyRecovery();

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ready) {
      toast.error("This password reset link is invalid or has expired.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      toast.error(friendlyError(error, "Could not update your password."));
      return;
    }

    window.sessionStorage.removeItem(RECOVERY_FLAG);
    await supabase.auth.signOut();
    toast.success("Password updated successfully. Please log in with your new password.");
    void navigate({ to: "/login" });
  };

  if (invalidLink) {
    return (
      <div className="page-container section-y max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Reset link unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This password reset link is invalid, expired, or has already been used.
          Request a new reset link to continue.
        </p>
        <div className="mt-6">
          <Button className="h-11 w-full" asChild>
            <Link to="/forgot-password">Request a new reset link</Link>
          </Button>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">Back to login</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page-container section-y max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a new password for your Edu Wallet account.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <Button type="submit" className="h-11 w-full" disabled={busy || !ready}>
          {busy ? "Updating…" : "Reset password"}
        </Button>
        </div>
      </form>
    </div>
  );
}
