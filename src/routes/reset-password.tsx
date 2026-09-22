import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/config/site";
import { friendlyError } from "@/lib/admin";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: `Set a new password — ${siteConfig.brandName}` },
      { name: "description", content: "Choose a new password for your Edu Wallet account." },
      { property: "og:title", content: `Set a new password — ${siteConfig.brandName}` },
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
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return void toast.error(friendlyError(error, "Could not update your password."));
    toast.success("Password updated.");
    void navigate({ to: "/" });
  };

  return (
    <div className="page-container section-y max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
