import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
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
      { name: "description", content: "Log in to your Edu Wallet account." },
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
    else void navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf4] text-[#252525]">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_.85fr]">
        <section className="relative hidden overflow-hidden bg-[#fff1dc] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.72),transparent_36%),linear-gradient(145deg,#fff7eb,#ffe8c8_52%,#ffd7bc)]" />
          <div className="absolute left-12 top-10 z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#252525] text-lg font-bold text-white">E</div>
            <span className="text-xl font-semibold">EduWallet</span>
          </div>
          <div className="relative z-10 flex min-h-screen items-center justify-center px-10 py-20">
            <div className="max-w-2xl text-center">
              <img src="https://raw.githubusercontent.com/flatlogic/one-react/master/src/images/signinImg.svg" alt="Student learning" className="mx-auto w-full max-w-[650px] drop-shadow-[0_28px_35px_rgba(71,52,34,.12)]" />
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">Your study resources, all in one place.</h2>
              <p className="mx-auto mt-4 max-w-lg leading-7 text-[#6d5c4b]">Sign in to access your purchased notes, assignments, guess papers and other learning resources.</p>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-[430px]">
            <div className="mb-10 lg:hidden">
              <Link to="/" className="inline-flex items-center gap-3 text-xl font-semibold">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252525] font-bold text-white">E</span>
                EduWallet
              </Link>
            </div>
            <div className="mb-9">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[.18em] text-[#b56b2a]">Welcome back</p>
              <h1 className="text-4xl font-semibold tracking-[-.03em] sm:text-[42px]">Log in to your account</h1>
              <p className="mt-3 text-[15px] leading-6 text-[#77706a]">Enter your details below to continue to EduWallet.</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-13 w-full rounded-xl border border-[#ded8d1] bg-white px-4 outline-none transition focus:border-[#252525] focus:ring-2 focus:ring-[#252525]/10" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <Link to="/forgot-password" className="text-sm font-medium text-[#a65d21] hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required className="h-13 w-full rounded-xl border border-[#ded8d1] bg-white px-4 pr-12 outline-none transition focus:border-[#252525] focus:ring-2 focus:ring-[#252525]/10" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#77706a]">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#6f6861]">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#252525]" /> Remember me
              </label>
              <button type="submit" disabled={busy} className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#252525] text-[15px] font-semibold text-white transition hover:bg-[#3b3b3b] disabled:opacity-60">
                {busy ? "Logging in…" : "Log in"} {!busy && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-[#e4dfda]" />
              <span className="text-xs uppercase tracking-[.16em] text-[#aaa39c]">Secure login</span>
              <div className="h-px flex-1 bg-[#e4dfda]" />
            </div>
            <p className="text-center text-sm text-[#77706a]">Don&apos;t have an account? <Link to="/register" className="font-semibold text-[#a65d21] hover:underline">Create an account</Link></p>
            <p className="mt-10 text-center text-xs leading-5 text-[#aaa39c]">By continuing, you agree to use EduWallet for legitimate educational purposes.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
