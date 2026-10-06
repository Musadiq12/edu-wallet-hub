import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/config/site";
import { friendlyError } from "@/lib/admin";

type Search = { redirect?: string };

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const redirect = search["redirect"];
    return typeof redirect === "string" ? { redirect } : {};
  },
  head: () => ({
    meta: [
      { title: `Create account — ${siteConfig.fallbackBrand.brandName}` },
      { name: "description", content: "Create your account." },
      { property: "og:title", content: `Create account — ${siteConfig.fallbackBrand.brandName}` },
      { property: "og:description", content: "Create your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { redirect } = Route.useSearch();
  const emailRedirectTo =
    typeof window !== "undefined"
      ? window.location.origin + "/"
      : "/";
  const [form, setForm] = useState({ full_name: "", email: "", whatsapp: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.full_name.trim()) return void toast.error("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return void toast.error("Enter a valid email address.");
    if (form.whatsapp.replace(/\D/g, "").length < 10) return void toast.error("Enter a valid WhatsApp number.");
    if (form.password.length < 8) return void toast.error("Password must be at least 8 characters.");

    setBusy(true);
    let data: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"];
    let error: Awaited<ReturnType<typeof supabase.auth.signUp>>["error"];

    try {
      const result = await supabase.auth.signUp({
        email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo,
        data: { full_name: form.full_name.trim(), whatsapp: form.whatsapp.trim() },
        },
      });
      data = result.data;
      error = result.error;
    } catch (err) {
      console.error("[register] Supabase signup request failed:", err);
      setBusy(false);
      toast.error(friendlyError(err, "Could not reach the account service. Please try again."));
      return;
    }
    setBusy(false);

    if (error) {
      toast.error(friendlyError(error, "Could not create your account."), { duration: 7000 });
      return;
    }

    if (data.session) {
      toast.success("Account created successfully.");
      window.location.assign(redirect?.startsWith("/") ? redirect : "/");
      return;
    }

    setConfirmationEmail(form.email.trim());
    setConfirmationSent(true);
    toast.success("Account created. Please check your email to confirm your account.");
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: confirmationEmail,
      options: { emailRedirectTo },
    });
    setBusy(false);

    if (error) {
      toast.error(friendlyError(error, "Could not resend the confirmation email."), { duration: 7000 });
      return;
    }
    toast.success("Confirmation email sent again.");
  };

  if (confirmationSent) {
    return (
      <div className="page-container section-y max-w-md">
        <div className="rounded-xl border bg-card p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account was created successfully. We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{confirmationEmail}</span>.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Open the email and click the confirmation link to verify your account. Once verified, you can log in.
          </p>
          <Button type="button" variant="outline" className="mt-6 h-11 w-full" onClick={resendConfirmation} disabled={busy}>
            {busy ? "Sending…" : "Resend confirmation email"}
          </Button>
          <Link to="/login" className="mt-4 block text-center text-sm text-primary hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container section-y max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We use your email and WhatsApp number to deliver your purchased resources.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5"><Label htmlFor="full_name">Full name</Label><Input id="full_name" className="h-11" value={form.full_name} onChange={set("full_name")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="h-11" value={form.email} onChange={set("email")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="whatsapp">WhatsApp number</Label><Input id="whatsapp" type="tel" inputMode="tel" className="h-11" value={form.whatsapp} onChange={set("whatsapp")} required /></div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" className="h-11 pr-10" value={form.password} onChange={set("password")} required />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2">
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="mt-4 text-sm">Already have an account?{" "}<Link to="/login" className="text-primary hover:underline">Log in</Link></p>
    </div>
  );
}
