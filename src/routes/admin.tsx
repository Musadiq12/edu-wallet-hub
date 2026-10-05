import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpenCheck, ChevronRight, ExternalLink, Gift, LayoutDashboard, LogOut, Menu, Moon, Package, Settings, ShoppingCart, Sun, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsAdmin, useSession, signOutCleanly } from "@/lib/auth";
import { revivorConfig } from "@/config/revivor";
import { cn } from "@/lib/utils";
import { adminOrdersQuery } from "@/lib/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin — ${revivorConfig.brandName}` },
      { name: "description", content: "Revivor CS Test Series administration area." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, exact: false },
  { to: "/admin/series", label: "Test Series", icon: Package, exact: false },
  { to: "/admin/tests", label: "Tests", icon: BookOpenCheck, exact: false },
  { to: "/admin/customers", label: "Students", icon: Users, exact: false },
  { to: "/admin/messages", label: "Leads & Messages", icon: Bell, exact: false },
  { to: "/admin/free-resources", label: "Free Resources", icon: Gift, exact: false },
  { to: "/admin/content", label: "Homepage Content", icon: BookOpenCheck, exact: false },
  { to: "/admin/settings", label: "Site Settings", icon: Settings, exact: false },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);
  const orders = useQuery({ ...adminOrdersQuery(), enabled: !!user && !!isAdmin });
  const pending = (orders.data ?? []).filter((o) => o.payment_status === "submitted" && o.order_status !== "cancelled").length;

  useEffect(() => {
    setDark(localStorage.getItem("revivor-admin-theme") === "dark");
  }, []);
  useEffect(() => {
    localStorage.setItem("revivor-admin-theme", dark ? "dark" : "light");
  }, [dark]);

  if (loading || (user && roleLoading)) {
    return <div className="grid min-h-screen place-items-center bg-[#f8f6f0] text-sm text-slate-500">Checking administrator access…</div>;
  }
  if (!user) {
    return <div className="mx-auto max-w-md px-6 py-20"><h1 className="text-2xl font-black text-slate-950">Administrator login</h1><p className="mt-2 text-sm text-slate-500">Sign in with the Revivor administrator account.</p><Button className="mt-5" asChild><Link to="/admin/login">Go to admin login</Link></Button></div>;
  }
  if (!isAdmin) {
    return <div className="mx-auto max-w-md px-6 py-20"><h1 className="text-2xl font-black">Access denied</h1><p className="mt-2 text-sm text-slate-500">This area is restricted to Revivor administrators.</p><div className="mt-5 flex gap-2"><Button variant="outline" asChild><Link to="/">Back to site</Link></Button><Button variant="ghost" onClick={async () => { await signOutCleanly(); void navigate({ to: "/login" }); }}>Log out</Button></div></div>;
  }

  const logout = async () => { await signOutCleanly(); void navigate({ to: "/" }); };

  const SideNav = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className="space-y-1" aria-label="Admin navigation">
      {NAV.map((item) => {
        const Icon = item.icon;
        return <Link key={item.label} to={item.to} activeOptions={{ exact: item.exact }} onClick={() => mobile && setMobileOpen(false)}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 data-[status=active]:bg-slate-950 data-[status=active]:text-white">
          <Icon className="size-4 shrink-0" /><span>{item.label}</span>{item.label === "Orders" && pending > 0 && <span className="ml-auto grid size-5 place-items-center rounded-full bg-amber-400 text-[10px] font-black text-slate-950">{pending}</span>}<ChevronRight className="ml-auto size-3 opacity-0 transition group-data-[status=active]:opacity-100" />
        </Link>;
      })}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700"><LogOut className="size-4" /> Log out</button>
      </div>
    </nav>
  );

  return <div className={cn("min-h-screen", dark ? "dark" : "")}>
    <div className="min-h-screen bg-[#f8f6f0] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col p-5">
          <Link to="/" className="mb-8 flex items-center gap-3 rounded-2xl p-2 hover:bg-slate-50">
            <span className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-lg font-black text-amber-400">R</span>
            <span><span className="block text-sm font-black">{revivorConfig.brandName}</span><span className="block text-xs text-slate-500">Admin Console</span></span>
          </Link>
          <SideNav />
          <div className="mt-auto rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Live site</p>
            <p className="mt-1 text-sm font-bold">Manage what students see.</p>
            <Link to="/" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200">Open website <ExternalLink className="size-3" /></Link>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[300px] bg-white p-5 shadow-2xl"><div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-950 font-black text-amber-400">R</span><span className="text-sm font-black">{revivorConfig.brandName}</span></div><Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}><X className="size-5" /></Button></div><SideNav mobile /></aside></div>}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></Button><div><p className="text-sm font-black sm:text-base">Admin Console</p><p className="hidden text-xs text-slate-500 sm:block">Control your Revivor storefront</p></div></div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 sm:flex sm:items-center sm:gap-2"><ExternalLink className="size-4" /> View site</Link>
            <button type="button" onClick={() => void navigate({ to: "/admin/orders" })} className="relative grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Orders"><Bell className="size-4" />{pending > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" />}</button>
            <button type="button" onClick={() => setDark((v) => !v)} className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Toggle theme">{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" /><div className="hidden max-w-[220px] sm:block"><p className="truncate text-xs font-bold">{user.email}</p><p className="text-[11px] text-slate-500">{roleLoading ? "Checking access" : "Administrator"}</p></div>
          </div>
        </header>
        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-7 lg:p-9"><div className="mx-auto max-w-[1500px]"><Outlet /></div></main>
      </div>
    </div>
  </div>;
}
