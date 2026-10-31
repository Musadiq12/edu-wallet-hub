import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND, buildMeta, buildTitle } from "@/lib/seo";
import { friendlyError } from "@/lib/admin";

type Search = { redirect?: string; mode?: "login" | "signup" };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {}),
    ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: buildTitle(["Account access", BRAND]) },
      { name: "description", content: buildMeta("Log in or create an EduWallet account to access your study resources.") },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect, mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">(initialMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");

  const safeRedirect = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : null;
  const emailRedirectTo =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
      ? window.location.origin + "/"
      : "https://eduwallethub.in/";

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return void toast.error("Enter your email and password.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return void toast.error(friendlyError(error, "Could not log in. Please try again."));
    toast.success("Logged in.");
    if (safeRedirect) window.location.assign(safeRedirect);
    else void navigate({ to: "/library" });
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return void toast.error("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return void toast.error("Enter a valid email address.");
    if (whatsapp.replace(/\D/g, "").length < 10) return void toast.error("Enter a valid WhatsApp number.");
    if (password.length < 8) return void toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo,
        data: { full_name: fullName.trim(), whatsapp: whatsapp.trim() },
      },
    });
    setBusy(false);
    if (error) return void toast.error(friendlyError(error, "Could not create your account."), { duration: 7000 });
    if (data.session) {
      toast.success("Account created successfully.");
      window.location.assign(safeRedirect ?? "/");
      return;
    }
    setConfirmationEmail(email.trim());
    toast.success("Account created. Check your email to confirm your account.");
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
    if (error) return void toast.error(friendlyError(error, "Could not resend the confirmation email."), { duration: 7000 });
    toast.success("Confirmation email sent again.");
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-primary lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,color-mix(in_oklch,var(--color-accent)_24%,transparent),transparent_34%),linear-gradient(145deg,color-mix(in_oklch,var(--color-primary)_96%,black),color-mix(in_oklch,var(--color-primary)_82%,var(--color-accent)))]" />
          <div className="absolute left-12 top-10 z-10 flex items-center gap-3 text-primary-foreground">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 text-lg font-bold">E</div>
            <span className="text-xl font-semibold">EduWallet</span>
          </div>
          <div className="relative z-10 flex min-h-screen items-center justify-center px-10 py-20">
            <div className="max-w-2xl text-center">
              <div className="mx-auto max-w-[600px] rounded-3xl border border-primary-foreground/15 bg-primary-foreground/95 p-8 shadow-2xl">
                <img src="https://raw.githubusercontent.com/flatlogic/one-react/master/src/images/signinImg.svg" alt="Student learning" className="mx-auto w-full max-w-[520px]" />
              </div>
              <h2 className="mt-8 text-4xl font-semibold tracking-tight text-primary-foreground">Your learning resources, all in one place.</h2>
              <p className="mx-auto mt-4 max-w-lg leading-7 text-primary-foreground/75">Create an account or sign in to access your purchased study materials through your EduWallet Library.</p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-primary-foreground/70"><ShieldCheck className="h-4 w-4" /> Secure account-based access</div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-background px-5 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-[440px]">
            <div className="mb-8 lg:hidden">
              <Link to="/" className="inline-flex items-center gap-3 text-xl font-semibold">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">E</span>
                EduWallet
              </Link>
            </div>

            {confirmationEmail ? (
              <div className="rounded-2xl border bg-card p-6 sm:p-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck size={24} /></div>
                <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">We sent a confirmation link to <span className="font-medium text-foreground">{confirmationEmail}</span>. Open the email and confirm your address before logging in.</p>
                <button type="button" onClick={resendConfirmation} disabled={busy} className="mt-6 h-11 w-full rounded-xl border font-medium hover:bg-muted disabled:opacity-60">{busy ? "Sending…" : "Resend confirmation email"}</button>
                <button type="button" onClick={() => { setConfirmationEmail(""); setMode("login"); }} className="mt-4 w-full text-sm font-semibold text-primary hover:underline">Back to login</button>
              </div>
            ) : (
              <>
                <div className="mb-7">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-accent">{mode === "login" ? "Welcome back" : "Get started"}</p>
                  <h1 className="text-3xl font-semibold tracking-[-.03em] sm:text-[38px]">{mode === "login" ? "Access your account" : "Create your account"}</h1>
                  <p className="mt-3 text-[15px] leading-6 text-muted-foreground">{mode === "login" ? "Sign in to manage your account and open your purchased resources." : "Create one account to purchase and access your learning resources."}</p>
                </div>

                <div className="mb-7 grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Account access">
                  <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Log in</button>
                  <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => setMode("signup")} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Create account</button>
                </div>

                <form onSubmit={mode === "login" ? submitLogin : submitSignup} className="space-y-4">
                  {mode === "signup" && <div><label htmlFor="fullName" className="mb-2 block text-sm font-medium">Full name</label><input id="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required className="h-12 w-full rounded-xl border border-input bg-card px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" /></div>}
                  <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label><input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-12 w-full rounded-xl border border-input bg-card px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" /></div>
                  {mode === "signup" && <div><label htmlFor="whatsapp" className="mb-2 block text-sm font-medium">WhatsApp number</label><input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Your WhatsApp number" required className="h-12 w-full rounded-xl border border-input bg-card px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" /></div>}
                  <div>
                    <div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium">Password</label>{mode === "login" && <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>}</div>
                    <div className="relative"><input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "login" ? "Enter your password" : "Create a password (8+ characters)"} required minLength={mode === "signup" ? 8 : undefined} className="h-12 w-full rounded-xl border border-input bg-card px-4 pr-12 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                    {mode === "signup" && <p className="mt-1.5 text-xs text-muted-foreground">Use at least 8 characters.</p>}
                  </div>
                  <button type="submit" disabled={busy} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">{busy ? (mode === "login" ? "Logging in…" : "Creating account…") : (mode === "login" ? "Log in" : "Create account")} {!busy && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}</button>
                </form>
                <div className="my-7 flex items-center gap-4"><div className="h-px flex-1 bg-border" /><span className="text-xs uppercase tracking-[.16em] text-muted-foreground">Secure account access</span><div className="h-px flex-1 bg-border" /></div>
                <p className="text-center text-xs leading-5 text-muted-foreground">After a verified purchase, your resource appears automatically in My Library.</p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
