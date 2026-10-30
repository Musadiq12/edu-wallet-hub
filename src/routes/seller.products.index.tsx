import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { sellerAccessToken, sellerProductsQuery } from "@/lib/seller-workspace";
import { sellerDeleteProduct } from "@/lib/seller-workspace.server-fns";

export const Route=createFileRoute("/seller/products/")({component:ProductsPage});
type ProductRow={id:string;title:string;course_label:string|null;subject_label:string|null;price:number|string;status:"pending"|"approved"|"rejected";is_archived:boolean;created_at:string;description:string|null;review_feedback:string|null};
const statusClass:Record<string,string>={pending:"border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",approved:"border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",rejected:"border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",archived:"border-border bg-muted text-muted-foreground"};
const money=(v:number|string)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v));
const date=(v:string)=>new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(new Date(v));
function ProductsPage(){
 const qc=useQueryClient();const query=useQuery(sellerProductsQuery("all"));
 const [target,setTarget]=useState<ProductRow|null>(null);const [busy,setBusy]=useState(false);
 const remove=async()=>{if(!target||busy)return;setBusy(true);try{const result=await sellerDeleteProduct({data:{accessToken:await sellerAccessToken(),id:target.id}});toast.success(result.result==="archived"?"Product archived. Existing buyers retain access.":"Product deleted.");setTarget(null);await qc.invalidateQueries({queryKey:["seller","products"]});await qc.invalidateQueries({queryKey:["products"]});}catch{toast.error("Could not remove this product. Please try again.");}finally{setBusy(false)}};
 const rows=(query.data??[]) as ProductRow[];
 return <SellerRouteGuard><SellerLayout>
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">Your products</h2><p className="mt-1 text-sm text-muted-foreground">Only notes uploaded from this seller account appear here.</p></div><Button asChild><Link to="/seller/products/new"><Plus className="mr-2 size-4"/>Add Product</Link></Button></div>
  {query.isError&&<div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">Could not load products. Please refresh.</div>}
  {query.isLoading?<div className="grid gap-3">{Array.from({length:4}).map((_,i)=><Skeleton className="h-28 w-full rounded-xl" key={i}/>)}</div>
  :rows.length===0?<Card className="border-dashed shadow-none"><CardContent className="py-12 text-center"><Archive className="mx-auto size-8 text-muted-foreground"/><h3 className="mt-3 font-semibold">No products yet</h3><p className="mt-1 text-sm text-muted-foreground">Upload your first study note to start selling on EduWallet.</p><Button asChild className="mt-4"><Link to="/seller/products/new">Add your first note</Link></Button></CardContent></Card>
  :<div className="space-y-3">{rows.map(row=>{const status=row.is_archived?"archived":row.status;return <Card key={row.id} className="shadow-sm"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="max-w-full truncate font-semibold">{row.title}</h3><Badge variant="outline" className={statusClass[status]}>{status[0].toUpperCase()+status.slice(1)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{row.course_label??"Other"} · {row.subject_label??"Subject not set"} · {date(row.created_at)}</p><p className="mt-1 text-sm font-semibold">{money(row.price)}</p>{row.status==="rejected"&&<p className="mt-2 break-words rounded-lg bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">Review feedback: {row.review_feedback||"No specific feedback was provided. Contact support for details."}</p>}</div><div className="flex shrink-0 gap-2">{!row.is_archived&&<Button asChild size="sm" variant="outline"><Link to="/seller/products/$id/edit" params={{id:row.id}}><Edit3 className="mr-1.5 size-4"/>Edit</Link></Button>}<Button size="sm" variant="destructive" disabled={busy||row.is_archived} onClick={()=>setTarget(row)}><Trash2 className="mr-1.5 size-4"/>Delete</Button></div></CardContent></Card>})}</div>}
  <AlertDialog open={!!target} onOpenChange={open=>!open&&!busy&&setTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this product?</AlertDialogTitle><AlertDialogDescription>If it has order history, it will be archived so existing buyers keep access. Otherwise, the product and its private files will be deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event=>{event.preventDefault();void remove()}}>{busy?"Removing…":"Confirm"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </SellerLayout></SellerRouteGuard>;
}
