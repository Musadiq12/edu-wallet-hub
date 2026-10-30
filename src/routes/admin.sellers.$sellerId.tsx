import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { adminSellerWalletsQuery, setSellerSuspension } from "@/lib/seller-finance.admin";

export const Route=createFileRoute("/admin/sellers/$sellerId")({component:AdminSellerDetailPage});
type Seller={seller_id:string;full_name:string|null;email:string|null;verification_status:string;is_suspended:boolean;total_sales:number;lifetime_earnings:number;commission_deducted:number;pending_balance:number;released_earnings:number;pending_withdrawals:number;withdrawable_balance:number};
const money=(v:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v??0));
function AdminSellerDetailPage(){
 const {sellerId}=useParams({from:"/admin/sellers/$sellerId"});
 const qc=useQueryClient();const query=useQuery(adminSellerWalletsQuery());
 const [reason,setReason]=useState("");
 const rows=(query.data??[]) as Seller[];
 const seller=rows.find(row=>row.seller_id===sellerId);
 const mutation=useMutation({
  mutationFn:(suspended:boolean)=>setSellerSuspension(sellerId,suspended,reason),
  onSuccess:async()=>{await qc.invalidateQueries({queryKey:["admin","seller-wallets"]});toast.success("Seller status updated.");},
  onError:(e:Error)=>toast.error(e.message),
 });
 const metrics=seller?[
  ["Total sales",String(seller.total_sales)],
  ["Lifetime net earnings",money(seller.lifetime_earnings)],
  ["Commission deducted",money(seller.commission_deducted)],
  ["Pending release",money(seller.pending_balance)],
  ["Released earnings",money(seller.released_earnings)],
  ["Pending withdrawals",money(seller.pending_withdrawals)],
  ["Withdrawable balance",money(seller.withdrawable_balance)],
 ]:[];
 return <div className="mx-auto max-w-4xl space-y-6">
  <Button variant="ghost" asChild className="-ml-3"><Link to="/admin/sellers"><ArrowLeft className="mr-2 size-4"/>Back to sellers</Link></Button>
  {query.isLoading?<Skeleton className="h-56 w-full"/>:query.isError?<p className="text-sm text-destructive">Could not load seller details.</p>:!seller?<Card><CardContent className="py-12 text-center"><p className="font-medium">Seller not found</p><p className="mt-1 text-sm text-muted-foreground">This account is not present in the seller applications list.</p></CardContent></Card>:
   <>
    <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{seller.full_name||"Seller"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{seller.email||seller.seller_id}</p><p className="mt-1 break-all text-xs text-muted-foreground">{seller.seller_id}</p></div><div className="flex gap-2"><Badge variant="outline">{seller.verification_status}</Badge><Badge variant={seller.is_suspended?"destructive":"secondary"}>{seller.is_suspended?"Suspended":"Active"}</Badge></div></div></CardHeader>
     <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label,value])=><div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>)}</CardContent>
    </Card>
    {seller.verification_status==="approved"&&!seller.is_suspended?<Card><CardHeader><CardTitle>Suspend seller</CardTitle><p className="text-sm text-muted-foreground">Suspension blocks seller workspace actions but preserves the KYC approval record and existing order history.</p></CardHeader><CardContent className="space-y-3"><Textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder="Required reason for suspension (minimum 3 characters)"/><Button variant="destructive" disabled={mutation.isPending||reason.trim().length<3} onClick={()=>mutation.mutate(true)}><ShieldAlert className="mr-2 size-4"/>Suspend seller</Button></CardContent></Card>
    :seller.verification_status==="approved"&&seller.is_suspended?<Card><CardHeader><CardTitle>Seller suspended</CardTitle></CardHeader><CardContent><Button variant="outline" disabled={mutation.isPending} onClick={()=>mutation.mutate(false)}><ShieldCheck className="mr-2 size-4"/>Reactivate seller</Button></CardContent></Card>:null}
   </>
  }
 </div>;
}
