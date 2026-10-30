import { Link, useLocation } from "@tanstack/react-router";
import { BadgeCheck, LayoutDashboard, Package, ShoppingBag, Wallet } from "lucide-react";
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
    <main className="page-container section-y space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><BadgeCheck className="size-4" /> Approved seller</div>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">Seller workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your study notes and track your sales.</p>
        </div>
        <nav aria-label="Seller workspace" className="flex flex-wrap gap-2">
          {links.map(item => {
            const active = location.pathname === item.to || (item.to !== "/seller/dashboard" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",active?"border-primary/30 bg-primary/10 text-primary":"border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" />{item.label}</Link>;
          })}
        </nav>
      </div>
      {children}
    </main>
  );
}
