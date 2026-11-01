import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert, ShieldCheck, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { adminSellerWalletsQuery, setSellerSuspension } from "@/lib/seller-finance.admin";
import { SellerEmailActions, sellerEmailDecisionKey } from "@/components/admin/SellerEmailActions";

export const Route=createFileRoute("/admin/sellers")({component:AdminSellersPage});
const money=(v:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v??0));
type Seller={seller_id:string;full_name:string|null;email:string|null;verification_status:string;is_suspended:boolean;total_sales:number;lifetime_earnings:number;commission_deducted:number;pending_balance:number;released_earnings:number;pending_withdrawals:number;withdrawable_balance:number};
function AdminSellersPage(){
 const pathname=useRouterState({select:state=>state.location.pathname});
 const qc=useQueryClient();
 const query=useQuery(adminSellerWalletsQuery());
 const [reason,setReason]=useState<Record<string,string>>({});
 const mutation=useMutation({
  mutationFn:({row,suspended}:{row:Seller;suspended:boolean})=>setSellerSuspension(row.seller_id,suspended,reason[row.seller_id]),
  onSuccess:async(_data,{row,suspended})=>{qc.setQueryData(sellerEmailDecisionKey(row.seller_id),{suspended,reason:suspended?(reason[row.seller_id]??"").trim():null});await qc.invalidateQueries({queryKey:["admin","seller-wallets"]});toast.success("Seller status updated.");},
  onError:(e:Error)=>toast.error(e.message),
 });
 const rows=(query.data??[]) as Seller[];
 if(pathname!=="/admin/sellers"&&pathname!=="/admin/sellers/")return <Outlet/>;
 return <div className="space-y-6">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Seller accounts</h1><p className="mt-1 text-sm text-muted-foreground">Verified sellers, attributed sales, earnings, and payout availability.</p></div><Button variant="outline" onClick={()=>void query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching?"mr-2 size-4 animate-spin":"mr-2 size-4"}/>Refresh</Button></div>
  {query.isError&&<div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Could not load seller accounts.</div>}
  {query.isLoading?<div className="grid gap-3 md:grid-cols-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-48 w-full"/>)}</div>
  :rows.length===0?<Card><CardContent className="py-12 text-center"><Store className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 font-medium">No approved sellers</p></CardContent></Card>
  :<div className="grid gap-4 xl:grid-cols-2">{rows.map(row=><Card key={row.seller_id} className="shadow-sm">
   <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{row.full_name||"Seller"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{row.email||row.seller_id}</p><p className="mt-1 text-xs text-muted-foreground">Seller ID {row.seller_id}</p></div><div className="flex flex-col items-end gap-1"><Badge variant="outline">{row.verification_status}</Badge>{row.is_suspended?<Badge variant="destructive">Suspended</Badge>:<Badge variant="secondary">Active</Badge>}</div></div></CardHeader>
   <CardContent className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
     <div><p className="text-xs text-muted-foreground">Total sales</p><p className="text-lg font-semibold tabular-nums">{row.total_sales}</p></div>
     <div><p className="text-xs text-muted-foreground">Lifetime net</p><p className="text-lg font-semibold tabular-nums">{money(row.lifetime_earnings)}</p></div>
     <div><p className="text-xs text-muted-foreground">Commission</p><p className="text-lg font-semibold tabular-nums">{money(row.commission_deducted)}</p></div>
     <div><p className="text-xs text-muted-foreground">Pending release</p><p className="text-lg font-semibold tabular-nums">{money(row.pending_balance)}</p></div>
     <div><p className="text-xs text-muted-foreground">Pending withdrawals</p><p className="text-lg font-semibold tabular-nums">{money(row.pending_withdrawals)}</p></div>
     <div><p className="text-xs text-muted-foreground">Withdrawable</p><p className="text-lg font-semibold tabular-nums">{money(row.withdrawable_balance)}</p></div>
    </div>
    {row.verification_status==="approved"&&!row.is_suspended?<div className="space-y-2 border-t pt-3"><label className="text-xs font-medium text-muted-foreground" htmlFor={"suspend-"+row.seller_id}>Reason to suspend</label><Textarea id={"suspend-"+row.seller_id} value={reason[row.seller_id]??""} onChange={e=>setReason(v=>({...v,[row.seller_id]:e.target.value}))} placeholder="Explain the reason (minimum 3 characters)" rows={2}/><Button variant="destructive" className="w-full" disabled={mutation.isPending||((reason[row.seller_id]??"").trim().length<3)} onClick={()=>mutation.mutate({row,suspended:true})}><ShieldAlert className="mr-2 size-4"/>Suspend seller</Button></div>
    :row.verification_status==="approved"&&row.is_suspended?<Button variant="outline" className="w-full" disabled={mutation.isPending} onClick={()=>mutation.mutate({row,suspended:false})}><ShieldCheck className="mr-2 size-4"/>Reactivate seller</Button>
    :<p className="border-t pt-3 text-xs text-muted-foreground">Suspension controls are available only after seller verification is approved.</p>}
    <Button variant="ghost" size="sm" asChild><Link to="/admin/sellers/$sellerId" params={{sellerId:row.seller_id}}>Open seller account</Link></Button>
    <SellerEmailActions seller={row}/>
   </CardContent>
  </Card>)}</div>}
 <Outlet/></div>;
}
