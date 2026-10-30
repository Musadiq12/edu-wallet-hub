import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Card,CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { sellerAccessToken,sellerProductQuery } from "@/lib/seller-workspace";
import { sellerCreatePrivateUploadPath,sellerSaveProductEdit } from "@/lib/seller-workspace.server-fns";
import { supabase } from "@/integrations/supabase/client";

export const Route=createFileRoute("/seller/products/$id/edit")({component:EditSellerProduct});
const exams=["NEET","JEE","UPSC","SSC","CGL","CLAT","CA","Other"] as const;
type Product={id:string;title:string;description:string;course_label:string;subject_label:string;price:number;pdf_file:string;preview_file:string|null;status:string;is_archived:boolean;rejection_reason?:string|null;review_feedback?:string|null};
type Kind="pdf"|"preview";
const MAX_PDF=20*1024*1024,MAX_PREVIEW=5*1024*1024;
function EditSellerProduct(){
 const {id}=Route.useParams();const query=useQuery(sellerProductQuery(id));
 return <SellerRouteGuard><SellerLayout>
  <div className="max-w-3xl space-y-5"><div><Link to="/seller/products" className="text-sm text-primary hover:underline">← Back to products</Link><h2 className="mt-2 text-xl font-semibold">Edit note</h2></div>
   {query.isLoading?<div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-12 w-full"/>)}</div>
   :query.isError||!query.data?<div role="alert" className="rounded-xl border border-border p-5 text-sm">This product could not be found.</div>
   :<ProductEditForm product={query.data as Product}/>}
  </div>
 </SellerLayout></SellerRouteGuard>;
}
function ProductEditForm({product}:{product:Product}){
 const navigate=useNavigate(),qc=useQueryClient(),lock=useRef(false);
 const [title,setTitle]=useState(product.title),[description,setDescription]=useState(product.description??""),[exam,setExam]=useState(product.course_label??"Other"),[subject,setSubject]=useState(product.subject_label??""),[price,setPrice]=useState(String(product.price??""));
 const [pdf,setPdf]=useState<File|null>(null),[preview,setPreview]=useState<File|null>(null),[removePreview,setRemovePreview]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[confirm,setConfirm]=useState(false);
 const [mainPath,setMainPath]=useState(product.pdf_file),[previewPath,setPreviewPath]=useState<string|null>(product.preview_file??null);
 const approved=product.status==="published"||product.status==="approved";
 if(product.is_archived)return <Card><CardContent className="space-y-2 p-5"><p className="font-semibold">This product is archived and cannot be edited.</p><Button asChild variant="outline"><Link to="/seller/products">Back to products</Link></Button></CardContent></Card>;
 const pick=(file:File|null,kind:Kind)=>{
  if(!file){kind==="pdf"?setPdf(null):setPreview(null);return;}
  const max=kind==="pdf"?MAX_PDF:MAX_PREVIEW;
  if(file.type!=="application/pdf"||!file.name.toLowerCase().endsWith(".pdf")){setError("Choose a valid PDF file.");return;}
  if(file.size>max){setError(kind==="pdf"?"Main PDF must be 20 MB or smaller.":"Preview must be 5 MB or smaller.");return;}
  kind==="pdf"?setPdf(file):setPreview(file);setError("");
 };
 const upload=async(file:File,kind:Kind,token:string)=>{
  const {path}=await sellerCreatePrivateUploadPath({data:{accessToken:token,originalName:file.name,kind}});
  const {error}=await supabase.storage.from("product-files").upload(path,file,{upsert:false,cacheControl:"0",contentType:"application/pdf"});
  if(error)throw new Error("The PDF upload failed. Please try again.");
  return path;
 };
 const save=async()=>{
  if(lock.current)return;
  const amount=Number(price);
  if(title.trim().length<5||title.trim().length>120)return setError("Title must be 5–120 characters.");
  if(description.trim().length<20||description.trim().length>2000)return setError("Description must be 20–2,000 characters.");
  if(!exams.includes(exam as typeof exams[number]))return setError("Choose an exam.");
  if(subject.trim().length<2||subject.trim().length>60)return setError("Subject must be 2–60 characters.");
  if(!/^(?:\d{1,4})(?:\.\d{1,2})?$/.test(price)||!Number.isFinite(amount)||amount<10||amount>5000)return setError("Enter a price between ₹10 and ₹5,000.");
  lock.current=true;setBusy(true);setError("");
  let newMain:string|null=null,newPreview:string|null=null;
  try{
   const token=await sellerAccessToken();
   if(pdf)newMain=await upload(pdf,"pdf",token);
   if(preview)newPreview=await upload(preview,"preview",token);
   const nextPdf=newMain??mainPath;
   const nextPreview=newPreview??(removePreview?null:previewPath);
   await sellerSaveProductEdit({data:{accessToken:token,id:product.id,title:title.trim(),description:description.trim(),exam,subject:subject.trim(),price:amount,pdfPath:nextPdf,previewPath:nextPreview}});
   newMain=null;newPreview=null;
   await qc.invalidateQueries({queryKey:["seller","products"]});await qc.invalidateQueries({queryKey:["seller","product",product.id]});
   toast.success(approved?"Changes submitted as a new review revision.":"Product resubmitted for review.");void navigate({to:"/seller/products",replace:true});
  }catch(err){
   const paths=[newMain,newPreview].filter((v):v is string=>!!v);if(paths.length)await supabase.storage.from("product-files").remove(paths).catch(()=>undefined);
   const message=err instanceof Error?err.message:"Could not save changes. Try again.";setError(message);toast.error(message);
  }finally{setBusy(false);lock.current=false;}
 };
 const onSubmit=(event:React.FormEvent)=>{event.preventDefault();if(approved)setConfirm(true);else void save()};
 return <>
  {approved&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">Editing a live note creates a separate pending revision. Your current live version remains available until the revision is approved.</div>}
  <Card><CardContent className="p-4 sm:p-6"><form onSubmit={onSubmit} className="space-y-5">
   <div className="space-y-2"><Label htmlFor="edit-title">Title</Label><Input id="edit-title" value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} required/></div>
   <div className="space-y-2"><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" rows={5} value={description} maxLength={2000} onChange={e=>setDescription(e.target.value)} required/></div>
   <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Exam</Label><Select value={exam} onValueChange={setExam}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{exams.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="edit-subject">Subject</Label><Input id="edit-subject" value={subject} maxLength={60} onChange={e=>setSubject(e.target.value)} required/></div></div>
   <div className="space-y-2"><Label htmlFor="edit-price">Price (INR ₹)</Label><Input id="edit-price" type="number" min="10" max="5000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required/></div>
   <div className="space-y-2"><Label htmlFor="edit-pdf">Replace notes PDF (optional)</Label><label htmlFor="edit-pdf" className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-4"><UploadCloud className="size-5"/><span className="min-w-0 text-sm">{pdf?.name??"Choose a new PDF (max 20 MB)"}</span></label><input id="edit-pdf" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e=>pick(e.target.files?.[0]??null,"pdf")}/><p className="text-xs text-muted-foreground">Current file: {product.pdf_file?.split("/").pop()}</p></div>
   <div className="space-y-2"><Label htmlFor="edit-preview">Preview PDF (optional)</Label><Input id="edit-preview" type="file" accept="application/pdf,.pdf" onChange={e=>pick(e.target.files?.[0]??null,"preview")}/>{preview&&<p className="text-xs text-muted-foreground">{preview.name}</p>}{previewPath&&!removePreview&&<button type="button" className="text-xs text-destructive underline" onClick={()=>setRemovePreview(true)}>Remove current preview</button>}</div>
   {error&&<p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
   <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" asChild disabled={busy}><Link to="/seller/products">Cancel</Link></Button><Button type="submit" disabled={busy}>{busy&&<Loader2 className="size-4 animate-spin"/>}{busy?"Saving…":"Save changes"}</Button></div>
  </form></CardContent></Card>
  <AlertDialog open={confirm} onOpenChange={open=>!open&&!busy&&setConfirm(false)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Send this note for review again?</AlertDialogTitle><AlertDialogDescription>Your current live version will stay available while the revised version is reviewed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Continue editing</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event=>{event.preventDefault();setConfirm(false);void save()}}>Save and resubmit</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
