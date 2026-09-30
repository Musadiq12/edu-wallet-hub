import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronsRight,
  ExternalLink,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Sun,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsAdmin, useSession, signOutCleanly } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { adminOrdersQuery } from "@/lib/admin";

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
  { to: "/admin/orders", label: "Sales", icon: ShoppingCart, exact: false },
  { to: "/", label: "View Site", icon: ExternalLink, exact: false, external: true },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/customers", label: "Customers", icon: Users, exact: false },
  { to: "/admin/messages", label: "Messages", icon: Bell, exact: false },
  { to: "/admin/free-resources", label: "Free Resources", icon: Gift, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);
  const orders = useQuery({ ...adminOrdersQuery(), enabled: !!user && !!isAdmin });
  const hasPendingOrders = (orders.data ?? []).some(
    (order) => order.payment_status === "submitted" && order.order_status !== "cancelled",
  );

  useEffect(() => {
    const saved = localStorage.getItem("eduwallet-admin-theme");
    setIsDark(saved === "dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("eduwallet-admin-theme", isDark ? "dark" : "light");
  }, [isDark]);

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 text-gray-600 dark:bg-gray-950 dark:text-gray-400">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          Checking your access…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
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
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is restricted to Edu Wallet administrators.
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

  const handleLogout = async () => {
    await signOutCleanly();
    void navigate({ to: "/" });
  };

  const SideNav = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className="flex flex-col gap-1" aria-label="Admin navigation">
      {NAV.map((item) => {
        const Icon = item.icon;

        if (item.external) {
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => mobile && setMobileOpen(false)}
              className="group relative flex h-11 w-full items-center rounded-lg text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              <span className="grid h-full w-12 shrink-0 place-content-center">
                <Icon className="h-4 w-4" />
              </span>
              {(open || mobile) && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        }

        return (
          <Link
            key={item.label}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            onClick={() => mobile && setMobileOpen(false)}
            className="group relative flex h-11 w-full items-center rounded-lg text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 data-[status=active]:border-l-2 data-[status=active]:border-blue-500 data-[status=active]:bg-blue-50 data-[status=active]:text-blue-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 dark:data-[status=active]:bg-blue-950/60 dark:data-[status=active]:text-blue-300"
          >
            <span className="grid h-full w-12 shrink-0 place-content-center">
              <Icon className="h-4 w-4" />
            </span>
            {(open || mobile) && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        );
      })}

      {(open || mobile) && (
        <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-800">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            System
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </nav>
  );

  return (
    <div className={cn("min-h-screen w-full", isDark ? "dark" : "")}>
      <div className="flex min-h-screen w-full bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <aside
          className={cn(
            "sticky top-0 z-40 hidden h-screen shrink-0 border-r border-gray-200 bg-white shadow-sm transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 lg:block",
            open ? "w-64" : "w-16",
          )}
        >
          <div className="flex h-full flex-col p-2">
            <div className="mb-5 border-b border-gray-200 pb-4 dark:border-gray-800">
              <div className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  {open && (
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold">EduWallet</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">Admin Panel</span>
                    </div>
                  )}
                </div>
                {open && <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <SideNav />
            </div>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="mt-2 flex h-11 shrink-0 items-center border-t border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            >
              <span className="grid w-12 place-content-center">
                <ChevronsRight className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-180")} />
              </span>
              {open && <span className="text-sm font-medium">Collapse</span>}
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative h-full w-[280px] border-r border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-content-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">EduWallet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Admin Panel</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <SideNav mobile />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/90 px-4 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/90 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open admin menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold sm:text-base">Admin Dashboard</p>
                <p className="hidden truncate text-xs text-gray-500 dark:text-gray-400 sm:block">
                  Manage your EduWallet store
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/"
                className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 md:flex"
              >
                <ExternalLink className="h-4 w-4" />
                View Site
              </Link>
              <button
                type="button"
                onClick={() => void navigate({ to: "/admin/orders" })}
                className="relative grid size-10 place-content-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label={hasPendingOrders ? "Pending orders" : "Notifications"}
                title={hasPendingOrders ? "You have pending orders" : "No new orders"}
              >
                <Bell className="h-5 w-5" />
                {hasPendingOrders && (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsDark((value) => !value)}
                className="grid size-10 place-content-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <div className="hidden h-8 w-px bg-gray-200 dark:bg-gray-800 sm:block" />
              <div className="hidden items-center gap-2 pl-1 sm:flex">
                <div className="grid size-8 place-content-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <Users className="h-4 w-4" />
                </div>
                <div className="max-w-[180px]">
                  <p className="truncate text-xs font-semibold">{user.email ?? "Administrator"}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Administrator</p>
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden bg-gray-50 p-4 dark:bg-gray-950 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
