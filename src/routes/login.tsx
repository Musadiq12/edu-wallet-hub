import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/config/site";
import { friendlyError } from "@/lib/admin";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Login — ${siteConfig.fallbackBrand.brandName}` },
      { name: "description", content: "Log in to your Edu Wallet account and access your purchased study resources." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast.error("Enter your email and password.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return toast.error(friendlyError(error, "Could not log in. Please try again."));
    toast.success("Logged in.");
    if (redirect?.startsWith("/")) window.location.assign(redirect);
    else void navigate({ to: "/library" });
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_.85fr]">
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
              <h2 className="mt-8 text-4xl font-semibold tracking-tight text-primary-foreground">Your purchased resources, always within reach.</h2>
              <p className="mx-auto mt-4 max-w-lg leading-7 text-primary-foreground/75">Verify your account to access your EduWallet Library. Your purchase is available on the website as well as through WhatsApp delivery.</p>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-primary-foreground/70"><ShieldCheck className="h-4 w-4" /> Secure account-based access</div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-background px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-[430px]">
            <div className="mb-10 lg:hidden">
              <Link to="/" className="inline-flex items-center gap-3 text-xl font-semibold">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">E</span>
                EduWallet
              </Link>
            </div>
            <div className="mb-9">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-accent">Welcome back</p>
              <h1 className="text-4xl font-semibold tracking-[-.03em] sm:text-[42px]">Log in to your account</h1>
              <p className="mt-3 text-[15px] leading-6 text-muted-foreground">Sign in to manage your account and open your purchased resources from My Library.</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-13 w-full rounded-xl border border-input bg-card px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required className="h-13 w-full rounded-xl border border-input bg-card px-4 pr-12 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--color-primary)]" /> Remember me
              </label>
              <button type="submit" disabled={busy} className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
                {busy ? "Logging in…" : "Log in"} {!busy && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-[.16em] text-muted-foreground">Secure login</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <p className="text-center text-sm text-muted-foreground">Don&apos;t have an account? <Link to="/register" className="font-semibold text-primary hover:underline">Create an account</Link></p>
            <p className="mt-10 text-center text-xs leading-5 text-muted-foreground">After a verified purchase, your resource appears automatically in My Library.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
