import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgePercent, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { adminCommissionQuery, setMarketplaceCommission } from "@/lib/seller-finance.admin";

export const Route=createFileRoute("/admin/commission")({component:AdminCommissionPage});
function AdminCommissionPage(){
 const qc=useQueryClient();
 const query=useQuery(adminCommissionQuery());
 const [rate,setRate]=useState("0");
 useEffect(()=>{if(query.data)setRate(String(Number(query.data.commission_rate??0)));},[query.data]);
 const mutation=useMutation({
  mutationFn:(value:number)=>setMarketplaceCommission(value),
  onSuccess:async()=>{await qc.invalidateQueries({queryKey:["admin","commission"]});toast.success("Commission updated. Only future verified orders use the new rate.");},
  onError:(e:Error)=>toast.error(e.message),
 });
 const submit=(event:React.FormEvent)=>{event.preventDefault();const value=Number(rate);if(!Number.isFinite(value)||value<0||value>100||Math.round(value*100)!==value*100){toast.error("Enter a rate from 0 to 100 with up to two decimals.");return;}mutation.mutate(value);};
 return <div className="mx-auto max-w-2xl space-y-6">
  <div><h1 className="text-2xl font-semibold tracking-tight">Marketplace commission</h1><p className="mt-1 text-sm text-muted-foreground">Set the marketplace fee deducted from new seller orders when payment is verified.</p></div>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><BadgePercent className="size-5"/> Commission rate</CardTitle></CardHeader><CardContent>
   {query.isLoading?<Skeleton className="h-24 w-full"/>:query.isError?<p className="text-sm text-destructive">Could not load the current commission.</p>:<form onSubmit={submit} className="space-y-4">
    <div className="space-y-1.5"><Label htmlFor="commission-rate">Commission (%)</Label><Input id="commission-rate" type="number" min="0" max="100" step="0.01" value={rate} onChange={e=>setRate(e.target.value)}/><p className="text-xs text-muted-foreground">Allowed: 0–100%, up to two decimal places. Current rate: {Number(query.data?.commission_rate??0)}%.</p></div>
    <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">Example on a ₹1,000 eligible order</p><div className="mt-2 grid grid-cols-2 gap-2"><p className="text-muted-foreground">Platform fee</p><p className="text-right font-semibold">₹{(1000*Number(rate||0)/100).toFixed(2)}</p><p className="text-muted-foreground">Seller net</p><p className="text-right font-semibold">₹{(1000-1000*Number(rate||0)/100).toFixed(2)}</p></div></div>
    <Button type="submit" disabled={mutation.isPending}>{mutation.isPending?"Saving…":"Save commission rate"}</Button>
   </form>}
  </CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5"/> How changes apply</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>The rate is snapshotted onto the order when payment verification completes. Changing the setting does not recalculate old orders or past seller earnings.</p><p>Seller dashboards and sales history show the commission amount and percentage captured for each eligible order.</p><p>Current configured default is 0%, preserving your existing no-commission arrangement.</p><p>Last updated: {query.data?.updated_at?new Date(query.data.updated_at).toLocaleString("en-IN"):"Not recorded"}.</p></CardContent></Card>
 </div>;
}
