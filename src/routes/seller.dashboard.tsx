import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, BookOpen, CalendarClock, CheckCircle2, Clock3, IndianRupee, Package, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { sellerDashboardQuery, sellerNotificationsQuery } from "@/lib/seller-workspace";
import { BRAND, buildTitle } from "@/lib/seo";

export const Route=createFileRoute("/seller/dashboard")({
  head:()=>({meta:[{title:buildTitle(["Seller Dashboard",BRAND])},{name:"robots",content:"noindex,nofollow"}]}),
  component:DashboardPage,
});
const money=(value:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(value);
const date=(value:string)=>new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(new Date(value));
const releaseDate=(value:string|null)=>value?date(value):"Release date is being calculated";
function DashboardPage(){
  const [now] = useState(() => Date.now());
  const query=useQuery(sellerDashboardQuery()); const data=query.data;
  const notifications=useQuery(sellerNotificationsQuery());
  const statItems=[
    {label:"Total sales",value:data?.totalSales??0,icon:ShoppingBag,sub:"Non-refunded orders",tone:"text-slate-700 dark:text-slate-200"},
    {label:"Net earnings",value:money(data?.totalEarned??0),icon:IndianRupee,sub:"Your share after recorded commission",tone:"text-indigo-700 dark:text-indigo-300"},
    {label:"Pending release",value:money(data?.pendingBalance??0),icon:Clock3,sub:"In the 7-day settlement hold",tone:"text-amber-700 dark:text-amber-300"},
    {label:"Available to withdraw",value:money(data?.availableBalance??0),icon:Wallet,sub:"After reserve and existing withdrawals",tone:"text-emerald-700 dark:text-emerald-300"},
  ];
  return <SellerRouteGuard><SellerLayout>
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 shadow-sm dark:border-emerald-900 dark:from-emerald-950/40 dark:via-card dark:to-slate-950 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200"><ShieldCheck className="size-5"/> Seller account verified</div><h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Your seller overview</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Track your products, sales and available earnings from one place.</p></div>
        <div className="flex flex-wrap gap-2"><Button asChild><Link to="/seller/products/new"><BookOpen className="mr-2 size-4"/> Add a resource</Link></Button><Button asChild variant="outline"><Link to="/seller/products">My products <ArrowRight className="ml-1 size-4"/></Link></Button></div>
      </div>
      
    </section>
    {query.isError&&<div role="alert" className="rounded-xl border border-destructive/30 bg-card p-4 text-sm">We couldn't load your seller summary. Your records have not been changed. Refresh to try again.</div>}
    <section aria-label="Earnings summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {statItems.map(item=>{const Icon=item.icon;return <Card key={item.label} className="rounded-2xl shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle><Icon className={`size-4 ${item.tone}`} aria-hidden="true"/></CardHeader><CardContent><div className="text-2xl font-bold tabular-nums tracking-tight">{query.isLoading?<Skeleton className="h-8 w-28"/>:item.value}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.sub}</p></CardContent></Card>})}
    </section>
    
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
      
      <Card className="rounded-2xl shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4"/> Product updates</CardTitle><p className="mt-1 text-sm text-muted-foreground">Review decisions and changes to your listings.</p></div><Button asChild variant="outline" size="sm"><Link to="/seller/products">Products <ArrowRight className="ml-1 size-4"/></Link></Button></CardHeader><CardContent>
        {notifications.isLoading?<Skeleton className="h-16 w-full"/>:notifications.isError?<p className="text-sm text-muted-foreground">Notifications could not be loaded. Refresh to try again.</p>:(notifications.data??[]).length===0?<div className="py-6 text-center"><Package className="mx-auto size-7 text-muted-foreground"/><p className="mt-2 text-sm font-medium">No product updates yet</p><p className="mt-1 text-xs text-muted-foreground">Review decisions will appear here when a product is checked.</p></div>:<div className="divide-y divide-border">{(notifications.data??[]).slice(0,5).map(item=><div key={item.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-medium">{item.title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p><p className="mt-1 text-xs text-muted-foreground">{date(item.created_at)}</p></div><span className={item.read_at?"size-2 shrink-0 rounded-full bg-muted":"mt-1 size-2 shrink-0 rounded-full bg-primary"} aria-label={item.read_at?"Read":"Unread"}/></div>)}</div>}
      </CardContent></Card>
    </div>
    <Card className="rounded-2xl shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="text-base">Recent sales</CardTitle><p className="mt-1 text-sm text-muted-foreground">Five latest orders attributed to your account.</p></div><Button asChild variant="outline" size="sm"><Link to="/seller/sales">View sales <ArrowRight className="ml-1 size-4"/></Link></Button></CardHeader><CardContent>
      {query.isLoading?<div className="space-y-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-14 w-full"/>)}</div>
      :!data?.recent.length?<div className="rounded-xl border border-dashed border-border px-5 py-10 text-center"><ShoppingBag className="mx-auto size-8 text-muted-foreground"/><h2 className="mt-3 font-semibold">No sales yet</h2><p className="mt-1 text-sm text-muted-foreground">Your first verified order will appear here. Make sure your resource listings are complete and published.</p><Button asChild className="mt-4"><Link to="/seller/products/new">Add your first resource</Link></Button></div>
      :<div className="divide-y divide-border">{data.recent.map(row=>{const pending=!!row.available_on&&new Date(row.available_on)>new Date(now);const status=row.refunded?"Refunded":pending?"Pending release":"Released";return <div key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.product_title}</p><p className="text-xs text-muted-foreground">{date(row.created_at)}</p><p className="mt-1 text-xs text-muted-foreground">{row.refunded?"Refunded order":pending?`Held until ${releaseDate(row.available_on)} · 7-day settlement`:"Settlement hold completed"}</p></div><div className="flex items-center gap-3"><span className="text-sm font-bold tabular-nums">{money(row.seller_share)}</span><span className={pending?"rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200":row.refunded?"rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-950/50 dark:text-red-200":"rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"}>{status}</span></div></div>})}</div>}
    </CardContent></Card>
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4"/> Your seller balances are calculated from the seller wallet ledger. For questions about a specific sale or payout, contact <a className="font-medium text-primary underline underline-offset-2" href="mailto:support@eduwallethub.in">seller support</a>.</p>
  </SellerLayout></SellerRouteGuard>;
}
function LockIcon(){return <BadgeCheck className="size-3.5"/>}
