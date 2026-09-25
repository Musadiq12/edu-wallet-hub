import { useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Gift,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Users,
  MessageSquare,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsAdmin, useSession, signOutCleanly } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin — ${siteConfig.fallbackBrand.brandName}` },
      { name: "description", content: "Edu Wallet administration area." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, exact: false },
  { to: "/admin/customers", label: "Customers", icon: Users, exact: false },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare, exact: false },
  { to: "/admin/free-resources", label: "Free Resources", icon: Gift, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);

  if (loading || (user && roleLoading)) {
    return (
      <div className="page-container section-y flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your access…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-container section-y max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Administrator login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please log in with an administrator account to open this area.
        </p>
        <Button className="mt-4 h-11" asChild>
          <Link to="/login" search={{ redirect: "/admin" }}>Go to login</Link>
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page-container section-y max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is restricted to Edu Wallet administrators. Your account does not have administrator access.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" asChild><Link to="/">Back to website</Link></Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await signOutCleanly();
              void navigate({ to: "/login" });
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    );
  }

  const SideNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact }}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground",
            "hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground",
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={async () => {
          onNavigate?.();
          await signOutCleanly();
          void navigate({ to: "/" });
        }}
        className="mt-1 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </nav>
  );

  return (
    <div className="page-container py-6">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <p className="text-sm font-semibold">Admin panel</p>
        <Button variant="outline" size="icon" aria-label={open ? "Close admin menu" : "Open admin menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-2 lg:hidden">
          <SideNav onNavigate={() => setOpen(false)} />
        </div>
      )}

      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20">
            <p className="mb-3 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> Admin panel
            </p>
            <SideNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
