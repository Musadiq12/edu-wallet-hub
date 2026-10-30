import { Link, useLocation } from "@tanstack/react-router";
import { BadgeCheck, CircleHelp, LayoutDashboard, Package, ShoppingBag, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/seller/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/seller/products", label: "My products", icon: Package },
  { to: "/seller/sales", label: "Sales", icon: ShoppingBag },
  { to: "/seller/wallet", label: "Wallet", icon: Wallet },
] as const;

export function SellerLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <main className="page-container py-7 sm:py-10">
      <header className="mb-7 space-y-5 border-b border-border pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              <BadgeCheck className="size-4" aria-hidden="true" /> Verified seller account
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Seller workspace</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Manage your study resources, follow earnings, and request UPI payouts.</p>
          </div>
          <a href="mailto:support@eduwallethub.in?subject=Seller%20support" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <CircleHelp className="size-4" aria-hidden="true" /> Seller support
          </a>
        </div>
        <nav aria-label="Seller workspace" className="flex w-full gap-2 overflow-x-auto pb-1">
          {links.map(item => {
            const active = location.pathname === item.to || (item.to !== "/seller/dashboard" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="size-4" aria-hidden="true" />{item.label}
            </Link>;
          })}
        </nav>
      </header>
      <div className="space-y-6">{children}</div>
    </main>
  );
}
