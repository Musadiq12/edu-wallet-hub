import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck, Bell, CircleHelp, LayoutDashboard, Package, ShoppingBag, Wallet,
  CheckCheck, PackageCheck, Banknote, ShoppingCart, ShieldAlert, Info, BellRing,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { sellerNotificationsQuery, sellerMarkNotificationRead, sellerMarkAllNotificationsRead } from "@/lib/seller-workspace";

const links = [
  { to: "/seller/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/seller/products", label: "My products", icon: Package },
  { to: "/seller/sales", label: "Sales", icon: ShoppingBag },
  { to: "/seller/wallet", label: "Wallet", icon: Wallet },
] as const;

type SellerNotification = {
  id: string;
  product_id: string | null;
  event_type: string;
  title: string;
  message: string;
  target_url: string | null;
  read_at: string | null;
  created_at: string;
};

function notificationIcon(eventType: string) {
  if (eventType.startsWith("account_")) return ShieldAlert;
  if (eventType.startsWith("payout_")) return Banknote;
  if (eventType === "sale_verified") return ShoppingCart;
  if (eventType === "low_stock") return PackageCheck;
  if (eventType === "approved" || eventType === "republished") return BadgeCheck;
  if (eventType === "rejected" || eventType === "unpublished") return ShieldAlert;
  return Info;
}

function relativeTime(value: string) {
  try { return formatDistanceToNow(new Date(value), { addSuffix: true }); }
  catch { return "Recently"; }
}

function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ ...sellerNotificationsQuery(), staleTime: 15_000 });
  const notifications = (query.data ?? []) as SellerNotification[];
  const unreadCount = useMemo(() => notifications.filter(item => !item.read_at).length, [notifications]);
  const markRead = useMutation({
    mutationFn: (id: string) => sellerMarkNotificationRead(id).mutationFn(),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["seller", "notifications"] });
      const previous = queryClient.getQueryData<SellerNotification[]>(["seller", "notifications"]);
      queryClient.setQueryData<SellerNotification[]>(["seller", "notifications"], rows =>
        (rows ?? []).map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["seller", "notifications"], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["seller", "notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => sellerMarkAllNotificationsRead().mutationFn(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["seller", "notifications"] });
      const previous = queryClient.getQueryData<SellerNotification[]>(["seller", "notifications"]);
      queryClient.setQueryData<SellerNotification[]>(["seller", "notifications"], rows =>
        (rows ?? []).map(item => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["seller", "notifications"], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["seller", "notifications"] }),
  });

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase.channel("seller-notifications-" + data.user.id)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "seller_notifications",
          filter: "seller_id=eq." + data.user.id,
        }, () => {
          void queryClient.invalidateQueries({ queryKey: ["seller", "notifications"] });
        })
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const openNotification = async (item: SellerNotification) => {
    if (!item.read_at) await markRead.mutateAsync(item.id);
    const target = item.target_url && item.target_url.startsWith("/") ? item.target_url : "/seller/notifications";
    await navigate({ to: target as never });
  };
  const openAllNotifications = async () => {
    await navigate({ to: "/seller/notifications" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative size-10 rounded-xl"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-[19px] items-center justify-center rounded-full border-2 border-background bg-destructive px-1 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[min( calc(100vw - 2rem), 390px)] overflow-hidden rounded-2xl p-0 shadow-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div><p className="text-sm font-semibold">Notifications</p><p className="mt-0.5 text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread update${unreadCount===1?"":"s"}` : "You're all caught up"}</p></div>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={!unreadCount || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck className="mr-1.5 size-3.5" /> Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[min(65vh,440px)] overflow-y-auto">
          {query.isLoading ? (
            <div className="space-y-3 p-4"><div className="h-12 animate-pulse rounded-lg bg-muted"/><div className="h-12 animate-pulse rounded-lg bg-muted"/><div className="h-12 animate-pulse rounded-lg bg-muted"/></div>
          ) : query.isError ? (
            <div className="px-5 py-8 text-center"><BellRing className="mx-auto size-6 text-muted-foreground"/><p className="mt-2 text-sm font-medium">Notifications unavailable</p><p className="mt-1 text-xs text-muted-foreground">Refresh the page to try again.</p></div>
          ) : notifications.length === 0 ? (
            <div className="px-5 py-9 text-center"><Bell className="mx-auto size-7 text-muted-foreground"/><p className="mt-2 text-sm font-semibold">No notifications yet</p><p className="mt-1 text-xs text-muted-foreground">Sales, product decisions, and payout updates will appear here.</p></div>
          ) : notifications.slice(0, 8).map(item => {
            const Icon = notificationIcon(item.event_type);
            return (
              <button key={item.id} type="button" onClick={() => void openNotification(item)}
                className={cn("flex w-full items-start gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/70 focus-visible:bg-muted focus-visible:outline-none", !item.read_at && "bg-primary/[0.045]")}>
                <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", !item.read_at ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}><Icon className="size-4" aria-hidden="true"/></span>
                <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-[13px] font-semibold leading-5">{item.title}</span>{!item.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread"/>}</span><span className="mt-0.5 block line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{item.message}</span><span className="mt-1.5 block text-[11px] text-muted-foreground">{relativeTime(item.created_at)}</span></span>
              </button>
            );
          })}
        </div>
        <DropdownMenuSeparator className="my-0"/>
        <button type="button" onClick={() => void openAllNotifications()} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-semibold text-primary transition-colors hover:bg-muted">View all notifications</button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
          <div className="flex items-center gap-2">
            <NotificationBell />
            <a href="mailto:support@eduwallethub.in?subject=Seller%20support" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <CircleHelp className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Seller support</span><span className="sm:hidden">Support</span>
            </a>
          </div>
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
