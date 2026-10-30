import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft,ChevronRight,ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card,CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { sellerSalesQuery } from "@/lib/seller-workspace";

export const Route=createFileRoute("/seller/sales")({component:SalesPage});
type Sale={id:string;created_at:string;product_title:string;seller_share:number;commission_amount:number;commission_rate:number;available_on:string|null;refunded:boolean;buyer_first_name:string};
const money=(v:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(v);
const date=(v:string)=>new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(new Date(v));
function SalesPage(){
 const [page,setPage]=useState(1);const query=useQuery(sellerSalesQuery(page));const rows=(query.data?.rows??[]) as Sale[];const total=query.data?.total??0;const pages=Math.max(1,Math.ceil(total/20));
 return <SellerRouteGuard><SellerLayout>
  <div><h2 className="text-xl font-semibold">Sales</h2><p className="mt-1 text-sm text-muted-foreground">Sales attributed to your seller account. Buyer contact and payment details are not shown.</p></div>
  {query.isError&&<div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Could not load your sales. Please refresh.</div>}
  {query.isLoading?<div className="space-y-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-24 w-full"/>)}</div>
  :rows.length===0?<Card className="border-dashed shadow-none"><CardContent className="py-12 text-center"><ReceiptText className="mx-auto size-8 text-muted-foreground"/><h3 className="mt-3 font-semibold">No sales yet</h3><p className="mt-1 text-sm text-muted-foreground">When someone purchases one of your approved notes, it will appear here.</p></CardContent></Card>
  :<div className="space-y-3">{rows.map(row=>{const status=row.refunded?"Refunded":row.available_on&&new Date(row.available_on)>new Date()?"Pending":"Available";return <Card key={row.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{row.product_title}</p><p className="mt-1 text-xs text-muted-foreground">{date(row.created_at)} · Buyer: {row.buyer_first_name||"Customer"}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><div className="text-right"><span className="block font-semibold tabular-nums">{money(Number(row.seller_share??0))}</span><span className="block text-xs text-muted-foreground">Commission {money(Number(row.commission_amount??0))} ({Number(row.commission_rate??0)}%)</span></div><Badge variant="outline" className={status==="Available"?"border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200":status==="Refunded"?"border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200":"border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"}>{status}</Badge></div></CardContent></Card>})}</div>}
  <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Page {page} of {pages} · {total} sales</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1||query.isFetching} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft className="mr-1 size-4"/>Previous</Button><Button variant="outline" size="sm" disabled={page>=pages||query.isFetching} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next<ChevronRight className="ml-1 size-4"/></Button></div></div>
 </SellerLayout></SellerRouteGuard>;
}
