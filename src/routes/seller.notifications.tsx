import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Banknote, Bell, BellRing, CheckCheck, PackageCheck, ShieldAlert, ShoppingCart, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { sellerNotificationsQuery, sellerMarkNotificationRead, sellerMarkAllNotificationsRead } from "@/lib/seller-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seller/notifications")({
  head: () => ({ meta: [{ title: "Notifications | EduWallet" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: SellerNotificationsPage,
});

type Notification = {
  id: string; product_id: string | null; event_type: string; title: string;
  message: string; target_url: string | null; read_at: string | null; created_at: string;
};

function IconFor({ type }: { type: string }) {
  const Icon = type.startsWith("account_") ? ShieldAlert
    : type.startsWith("payout_") ? Banknote
    : type === "sale_verified" ? ShoppingCart
    : type === "low_stock" ? PackageCheck
    : ["approved", "republished"].includes(type) ? PackageCheck : Info;
  return <Icon className="size-5" aria-hidden="true"/>;
}
function timestamp(value: string) {
  try { return formatDistanceToNow(new Date(value), { addSuffix: true }); } catch { return "Recently"; }
}

function SellerNotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ ...sellerNotificationsQuery(), staleTime: 15_000 });
  const rows = (query.data ?? []) as Notification[];
  const unreadCount = useMemo(() => rows.filter(item => !item.read_at).length, [rows]);
  const markOne = useMutation({
    mutationFn: (id: string) => sellerMarkNotificationRead(id).mutationFn(),
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: ["seller","notifications"] });
      const previous = queryClient.getQueryData<Notification[]>(["seller","notifications"]);
      queryClient.setQueryData<Notification[]>(["seller","notifications"], current =>
        (current ?? []).map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
      return { previous };
    },
    onError: (_error, _id, context) => { if (context?.previous) queryClient.setQueryData(["seller","notifications"], context.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["seller","notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => sellerMarkAllNotificationsRead().mutationFn(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["seller","notifications"] });
      const previous = queryClient.getQueryData<Notification[]>(["seller","notifications"]);
      queryClient.setQueryData<Notification[]>(["seller","notifications"], current =>
        (current ?? []).map(item => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
      return { previous };
    },
    onError: (_error, _variables, context) => { if (context?.previous) queryClient.setQueryData(["seller","notifications"], context.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["seller","notifications"] }),
  });

  const open = async (item: Notification) => {
    if (!item.read_at) await markOne.mutateAsync(item.id);
    const target = item.target_url?.startsWith("/") ? item.target_url : "/seller/notifications";
    await navigate({ to: target as never });
  };

  return <SellerRouteGuard><SellerLayout>
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-muted-foreground">Seller workspace</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Notifications</h2><p className="mt-1 text-sm text-muted-foreground">Product decisions, sales, account updates, inventory alerts and payouts.</p></div>
      <Button variant="outline" disabled={!unreadCount || markAll.isPending} onClick={() => markAll.mutate()}><CheckCheck className="mr-2 size-4"/> Mark all as read</Button>
    </section>
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardHeader className="border-b border-border bg-muted/20"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4"/> All notifications</CardTitle><span className="text-xs text-muted-foreground">{unreadCount} unread</span></div></CardHeader>
      <CardContent className="p-0">
        {query.isLoading ? <div className="space-y-4 p-5">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-20 w-full"/>)}</div>
        : query.isError ? <div role="alert" className="px-6 py-12 text-center"><BellRing className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 font-semibold">Could not load notifications</p><p className="mt-1 text-sm text-muted-foreground">Refresh this page to try again.</p><Button className="mt-4" variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>
        : rows.length === 0 ? <div className="px-6 py-16 text-center"><Bell className="mx-auto size-9 text-muted-foreground"/><p className="mt-3 font-semibold">No notifications yet</p><p className="mt-1 text-sm text-muted-foreground">Updates about your seller account and store will appear here.</p><Button asChild variant="outline" className="mt-4"><Link to="/seller/dashboard">Back to overview</Link></Button></div>
        : <div className="divide-y divide-border">{rows.map(item => <button key={item.id} type="button" onClick={() => void open(item)}
          className={cn("flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50 sm:px-6", !item.read_at && "bg-primary/[0.035]")}>
          <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", !item.read_at ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}><IconFor type={item.event_type}/></span>
          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{item.title}</span>{!item.read_at && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">NEW</span>}</span><span className="mt-1 block whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.message}</span><span className="mt-2 block text-xs text-muted-foreground">{timestamp(item.created_at)}</span></span>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground"/>
        </button>)}</div>}
      </CardContent>
    </Card>
    <p className="text-xs text-muted-foreground">Notifications are private to your verified seller account. <Link to="/seller/dashboard" className="font-medium text-primary hover:underline">Return to dashboard</Link>.</p>
  </SellerLayout></SellerRouteGuard>;
}
