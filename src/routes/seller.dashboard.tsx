import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { BRAND, buildMeta, buildTitle } from "@/lib/seo";

type MarketplaceRole = "buyer" | "seller" | "admin" | null;

export const Route = createFileRoute("/seller/dashboard")({
  head: () => ({
    meta: [
      { title: buildTitle(["Seller Dashboard", BRAND]) },
      { name: "robots", content: "noindex, follow" },
      { name: "description", content: buildMeta("Seller workspace for EduWallet marketplace creators.") },
    ],
  }),
  component: SellerDashboardGate,
});

function SellerDashboardGate() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [role, setRole] = useState<MarketplaceRole>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", search: { redirect: "/seller/dashboard" }, replace: true });
      setChecking(false);
      return;
    }
    const profilesTable = supabase.from("profiles") as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { role?: string | null } | null; error: { message?: string } | null }>;
        };
      };
    };
    profilesTable.select("role").eq("id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        const currentRole = error ? null : data?.role ?? "buyer";
        const nextRole = currentRole === "seller" || currentRole === "admin" ? currentRole : "buyer";
        setRole(nextRole);
        setChecking(false);
        if (nextRole === "buyer") {
          void navigate({ to: "/become-seller", replace: true });
        }
      });
    return () => { active = false; };
  }, [loading, navigate, user]);

  if (loading || checking) {
    return <div className="page-container flex min-h-[60vh] items-center justify-center py-16"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />Checking seller access…</div></div>;
  }
  if (!user || !role || role === "buyer") return null;

  return (
    <div className="page-container section-y">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Store className="size-6" /></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.16em] text-secondary">EduWallet marketplace</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Seller dashboard</h1>
        <p className="mt-3 leading-7 text-muted-foreground">Your account is approved for seller access. The product upload, sales and payout workspace is the next marketplace component and is not available yet.</p>
        <Button asChild className="mt-6"><Link to="/shop">Browse EduWallet resources <ArrowRight className="ml-2 size-4" /></Link></Button>
      </div>
    </div>
  );
}
