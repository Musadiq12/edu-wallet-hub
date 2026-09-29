import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/config/site";
import { friendlyError } from "@/lib/admin";

const passwordRequirements = [
  { key: "length", label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { key: "letter", label: "Contains a letter", test: (value: string) => /[A-Za-z]/.test(value) },
  { key: "number", label: "Contains a number", test: (value: string) => /\d/.test(value) },
  { key: "special", label: "Contains a special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
  }),
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
  const { email: initialEmail } = Route.useSearch();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);

  const requirements = passwordRequirements.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
  const passwordScore = requirements.filter((requirement) => requirement.met).length;
  const passwordStrong = passwordScore === passwordRequirements.length;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const verifyCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, "").slice(0, 6);

    if (!normalizedEmail || normalizedCode.length !== 6) {
      toast.error("Enter your email and the 6-digit code.");
      return;
    }

    setCheckingCode(true);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedCode,
      type: "recovery",
    });
    setCheckingCode(false);

    if (error) {
      toast.error(friendlyError(error, "That reset code is invalid or expired."));
      return;
    }

    setVerified(true);
    toast.success("Code verified. You can now set a new password.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verified) {
      await verifyCode();
      return;
    }

    if (!passwordStrong) {
      toast.error("Please meet all password requirements.");
      return;
    }

    if (!passwordsMatch) {
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

  return (
    <div className="page-container section-y max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {verified
          ? "Choose a strong new password for your account."
          : "Enter the 6-digit code sent to your email address."}
      </p>

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
            disabled={verified}
            required
          />
        </div>

        {!verified && (
          <div className="space-y-1.5">
            <Label htmlFor="code">Reset code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="h-11 tracking-[0.35em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
            />
            <p className="text-xs text-muted-foreground">Enter the 6-digit code from your email.</p>
          </div>
        )}

        {verified && (
          <>
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
                  {passwordStrong ? "Strong password" : "Password requirements"}
                </p>
                <div className="space-y-1.5">
                  {requirements.map((requirement) => (
                    <div key={requirement.key} className="flex items-center gap-2">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                          requirement.met
                            ? "bg-primary text-primary-foreground"
                            : "border border-muted-foreground/40 text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <span className={requirement.met ? "text-foreground" : "text-muted-foreground"}>
                        {requirement.label}
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword.length > 0 && (
                <p className={passwordsMatch ? "text-xs text-primary" : "text-xs text-destructive"}>
                  {passwordsMatch ? "✓ Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>
          </>
        )}

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={busy || checkingCode || (!verified && code.length !== 6)}
        >
          {checkingCode ? "Verifying…" : busy ? "Updating…" : verified ? "Set new password" : "Verify code"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">Back to login</Link>
      </p>
    </div>
  );
}
