import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, IndianRupee, Package, ShoppingBag, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { sellerDashboardQuery } from "@/lib/seller-workspace";
import { BRAND, buildTitle } from "@/lib/seo";

export const Route=createFileRoute("/seller/dashboard")({
  head:()=>({meta:[{title:buildTitle(["Seller Dashboard",BRAND])},{name:"robots",content:"noindex,nofollow"}]}),
  component:DashboardPage,
});
const money=(value:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(value);
const date=(value:string)=>new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(new Date(value));
function DashboardPage(){
  const query=useQuery(sellerDashboardQuery()); const data=query.data;
  const stats=[
    {label:"Total sales",value:data?.totalSales??0,icon:ShoppingBag,sub:"Non-refunded orders"},
    {label:"Total earned",value:money(data?.totalEarned??0),icon:IndianRupee,sub:"Excludes refunded orders"},
    {label:"Pending balance",value:money(data?.pendingBalance??0),icon:Wallet,sub:"Moves to Available after the hold period (7 days)."},
    {label:"Available balance",value:money(data?.availableBalance??0),icon:Package,sub:"Released seller earnings"},
  ];
  return <SellerRouteGuard><SellerLayout>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(item=>{const Icon=item.icon;return <Card key={item.label} className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle><Icon className="size-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{query.isLoading?<Skeleton className="h-8 w-28"/>:item.value}</div><p className="mt-1 text-xs text-muted-foreground">{item.sub}</p></CardContent></Card>})}
    </div>
    {query.isError&&<div role="alert" className="rounded-xl border border-destructive/30 bg-card p-4 text-sm">We couldn't load your seller summary. Refresh and try again.</div>}
    <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle>Recent sales</CardTitle><p className="mt-1 text-sm text-muted-foreground">Your five latest orders</p></div><Button asChild variant="outline" size="sm"><Link to="/seller/sales">View all <ArrowUpRight className="ml-1 size-4"/></Link></Button></CardHeader><CardContent>
      {query.isLoading?<div className="space-y-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-14 w-full"/>)}</div>
      :!data?.recent.length?<div className="rounded-xl border border-dashed border-border px-5 py-10 text-center"><ShoppingBag className="mx-auto size-8 text-muted-foreground"/><h2 className="mt-3 font-semibold">No sales yet</h2><p className="mt-1 text-sm text-muted-foreground">No sales yet. Upload your first note to get started.</p><Button asChild className="mt-4"><Link to="/seller/products/new">Upload your first note</Link></Button></div>
      :<div className="divide-y divide-border">{data.recent.map(row=>{const status=row.refunded?"Refunded":row.available_on&&new Date(row.available_on)>new Date()?"Pending":"Available";return <div key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{row.product_title}</p><p className="text-xs text-muted-foreground">{date(row.created_at)}</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold tabular-nums">{money(row.seller_share)}</span><span className={status==="Available"?"rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300":status==="Refunded"?"rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive":"rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"}>{status}</span></div></div>})}</div>}
    </CardContent></Card>
  </SellerLayout></SellerRouteGuard>;
}
