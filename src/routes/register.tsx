import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signupServer } from "@/server/auth.functions";
import { siteConfig } from "@/config/site";

type Search = { redirect?: string };

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): Search => {
  const redirect = search["redirect"];

  return typeof redirect === "string"
    ? { redirect }
    : {};
},
  head: () => ({
    meta: [
      { title: `Create account — ${siteConfig.fallbackBrand.brandName}` },
      { name: "description", content: "Create an Edu Wallet account to order IGNOU notes, guess papers and study guides." },
      { property: "og:title", content: `Create account — ${siteConfig.fallbackBrand.brandName}` },
      { property: "og:description", content: "Create your Edu Wallet student account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [form, setForm] = useState({ full_name: "", email: "", whatsapp: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const validation = await signupServer({
      data: {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        whatsapp: form.whatsapp,
      },
    });

    if (!("ok" in validation) || !validation.ok) {
      setBusy(false);
      toast.error("Could not create your account. Please check your details and try again.");
      return;
    }

    const validated = validation.data as {
      email: string;
      password: string;
      full_name: string;
      whatsapp?: string;
    };

    const { error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: validated.full_name,
          whatsapp: validated.whatsapp || "",
        },
      },
    });

    setBusy(false);
    if (error) {
      toast.error("Could not create your account. Please check your details and try again.");
      return;
    }

    toast.success("Account created.");
    if (redirect?.startsWith("/")) window.location.assign(redirect);
    else void navigate({ to: "/" });
  };

  return (
    <div className="page-container section-y max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We use your email and WhatsApp number to deliver your purchased resources.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" className="h-11" value={form.full_name} onChange={set("full_name")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" className="h-11" value={form.email} onChange={set("email")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp number</Label>
          <Input id="whatsapp" type="tel" inputMode="tel" className="h-11" value={form.whatsapp} onChange={set("whatsapp")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
  <Input
    id="password"
    type={showPassword ? "text" : "password"}
    autoComplete="new-password"
    className="h-11 pr-10"
    value={form.password}
    onChange={set("password")}
    required
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2"
  >
    {showPassword ? "🙈" : "👁️"}
  </button>
</div>
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-primary hover:underline">Log in</Link>
      </p>
    </div>
  );
}
