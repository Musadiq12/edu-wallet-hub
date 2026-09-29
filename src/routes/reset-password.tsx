import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/config/site";
import { friendlyError } from "@/lib/admin";

const requirements = [
  ["length", "At least 8 characters", (v: string) => v.length >= 8],
  ["letter", "Contains a letter", (v: string) => /[A-Za-z]/.test(v)],
  ["number", "Contains a number", (v: string) => /\d/.test(v)],
  ["special", "Contains a special character", (v: string) => /[^A-Za-z0-9]/.test(v)],
] as const;

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: `Set a new password — ${siteConfig.fallbackBrand.brandName}` },
      { name: "description", content: "Choose a new password for your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setReady(!!session);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY" && session) setReady(true);
      },
    );

    void checkRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const strength = requirements.map(([key, label, test]) => ({
    key,
    label,
    met: test(password),
  }));
  const strong = strength.every((item) => item.met);
  const match = password.length > 0 && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!strong) {
      toast.error("Please meet all password requirements.");
      return;
    }

    if (!match) {
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

    await supabase.auth.signOut();
    toast.success("Password updated successfully. Please log in with your new password.");
    void navigate({ to: "/login" });
  };

  if (ready === null) {
    return (
      <div className="page-container section-y max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Verifying your secure reset link…
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="page-container section-y max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Invalid or expired link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This password reset link is invalid or has expired. Request a new link and try again.
        </p>
        <Button asChild className="mt-6 h-11 w-full">
          <Link to="/forgot-password">Request a new reset link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="page-container section-y max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a strong new password for your account.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="rounded-lg border border-border bg-surface p-3 text-sm">
            <p className="mb-2 font-medium">
              {strong ? "Strong password" : "Password requirements"}
            </p>
            <div className="space-y-1.5">
              {strength.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                      item.met
                        ? "bg-primary text-primary-foreground"
                        : "border border-muted-foreground/40 text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className={item.met ? "text-foreground" : "text-muted-foreground"}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {confirm.length > 0 && (
            <p className={match ? "text-xs text-primary" : "text-xs text-destructive"}>
              {match ? "✓ Passwords match" : "Passwords do not match"}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={busy || !strong || !match}
        >
          {busy ? "Updating…" : "Set new password"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">Back to login</Link>
      </p>
    </div>
  );
}
