import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { sellerAccessToken } from "@/lib/seller-workspace";
import { sellerCreatePrivateUploadPath, sellerCreateProduct } from "@/lib/seller-workspace.server-fns";
import { supabase } from "@/integrations/supabase/client";

export const Route=createFileRoute("/seller/products/new")({component:NewSellerProduct});
const exams=["NEET","JEE","UPSC","SSC","CGL","CLAT","CA","Other"] as const;
const MAX_PDF=20*1024*1024,MAX_PREVIEW=5*1024*1024;
type Kind="pdf"|"preview";
function NewSellerProduct(){
 const navigate=useNavigate(),qc=useQueryClient(),lock=useRef(false);
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[exam,setExam]=useState(""),[subject,setSubject]=useState(""),[price,setPrice]=useState("");
 const [pdf,setPdf]=useState<File|null>(null),[preview,setPreview]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const pick=(file:File|null,kind:Kind)=>{
  if(!file){kind==="pdf"?setPdf(null):setPreview(null);return;}
  const limit=kind==="pdf"?MAX_PDF:MAX_PREVIEW;
  if(file.type!=="application/pdf"||!file.name.toLowerCase().endsWith(".pdf")){setError("Choose a PDF file with a valid PDF MIME type.");return;}
  if(file.size>limit){setError(kind==="pdf"?"Main PDF must be 20 MB or smaller.":"Preview PDF must be 5 MB or smaller.");return;}
  if(kind==="pdf")setPdf(file);else setPreview(file);setError("");
 };
 const upload=async(file:File,kind:Kind,token:string)=>{
   const {path}=await sellerCreatePrivateUploadPath({data:{accessToken:token,originalName:file.name,kind}});
   const {error}=await supabase.storage.from("product-files").upload(path,file,{upsert:false,cacheControl:"0",contentType:"application/pdf"});
   if(error)throw new Error(kind==="pdf"?"The PDF upload failed. Try again.":"The preview upload failed. Try again.");
   return path;
 };
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(lock.current)return;
  const amount=Number(price);
  if(title.trim().length<5||title.trim().length>120)return setError("Title must be 5–120 characters.");
  if(description.trim().length<20||description.trim().length>2000)return setError("Description must be 20–2000 characters.");
  if(!exams.includes(exam as typeof exams[number]))return setError("Choose an exam.");
  if(subject.trim().length<2||subject.trim().length>60)return setError("Subject must be 2–60 characters.");
  if(!/^(?:\d{1,4})(?:\.\d{1,2})?$/.test(price)||!Number.isFinite(amount)||amount<10||amount>5000)return setError("Enter a price between ₹10 and ₹5,000 with up to 2 decimals.");
  if(!pdf)return setError("Upload your main notes PDF.");
  lock.current=true;setBusy(true);setError("");
  let mainPath:string|null=null,previewPath:string|null=null;
  try{
   const token=await sellerAccessToken();
   mainPath=await upload(pdf,"pdf",token);
   if(preview)previewPath=await upload(preview,"preview",token);
   await sellerCreateProduct({data:{accessToken:token,title:title.trim(),description:description.trim(),exam,subject:subject.trim(),price:amount,pdfPath:mainPath,previewPath}});
   mainPath=null;previewPath=null;
   await qc.invalidateQueries({queryKey:["seller","products"]});
   toast.success("Product submitted for review.");
   void navigate({to:"/seller/products",replace:true});
  }catch(err){
   if(mainPath||previewPath){const paths=[mainPath,previewPath].filter((p):p is string=>!!p);await supabase.storage.from("product-files").remove(paths).catch(()=>undefined);}
   const message=err instanceof Error?err.message:"Could not upload this product. Please try again.";
   setError(message);toast.error(message);
  }finally{setBusy(false);lock.current=false;}
 };
 return <SellerRouteGuard><SellerLayout>
  <div className="max-w-3xl space-y-5">
   <div><h2 className="text-xl font-semibold">Upload a study note</h2><p className="mt-1 text-sm text-muted-foreground">Add your PDF and submit it for review before it appears in the store.</p></div>
   <Card className="shadow-sm"><CardContent className="space-y-5 p-4 sm:p-6">
    <form onSubmit={submit} className="space-y-5">
     <div className="space-y-2"><Label htmlFor="seller-title">Title</Label><Input id="seller-title" maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. UPSC Polity Complete Notes" required/><p className="text-xs text-muted-foreground">5–120 characters</p></div>
     <div className="space-y-2"><Label htmlFor="seller-description">Description</Label><Textarea id="seller-description" rows={5} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe what students will learn and what the notes include." required/><p className="text-xs text-muted-foreground">20–2,000 characters</p></div>
     <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="seller-exam">Exam</Label><Select value={exam} onValueChange={setExam}><SelectTrigger id="seller-exam"><SelectValue placeholder="Select exam"/></SelectTrigger><SelectContent>{exams.map(item=><SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="seller-subject">Subject</Label><Input id="seller-subject" maxLength={60} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Indian Polity" required/></div>
     </div>
     <div className="space-y-2"><Label htmlFor="seller-price">Price (INR ₹)</Label><Input id="seller-price" type="number" min="10" max="5000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="99.00" required/><p className="text-xs text-muted-foreground">₹10–₹5,000; up to two decimal places.</p></div>
     <div className="space-y-2"><Label htmlFor="seller-pdf">Notes PDF <span className="text-destructive">*</span></Label><label htmlFor="seller-pdf" className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-7 text-center hover:bg-muted/40"><UploadCloud className="size-7 text-muted-foreground"/><span className="mt-2 text-sm font-medium">{pdf?.name??"Choose your notes PDF"}</span><span className="mt-1 text-xs text-muted-foreground">PDF only · Maximum 20 MB</span></label><input id="seller-pdf" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e=>pick(e.target.files?.[0]??null,"pdf")}/>{pdf&&<div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="size-4"/>{(pdf.size/1024/1024).toFixed(2)} MB <button type="button" className="ml-auto text-destructive underline" onClick={()=>setPdf(null)}>Remove</button></div>}</div>
     <div className="space-y-2"><Label htmlFor="seller-preview">Preview PDF (optional)</Label><Input id="seller-preview" type="file" accept="application/pdf,.pdf" onChange={e=>pick(e.target.files?.[0]??null,"preview")}/><p className="text-xs text-muted-foreground">Optional sample pages for customers · Maximum 5 MB</p>{preview&&<p className="text-xs text-muted-foreground">{preview.name} · {(preview.size/1024/1024).toFixed(2)} MB</p>}</div>
     <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300"/><p>Your note will be reviewed before it goes live (usually within 24 to 48 hours).</p></div>
     {error&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
     <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" asChild disabled={busy}><Link to="/seller/products">Cancel</Link></Button><Button type="submit" disabled={busy}>{busy&&<Loader2 className="size-4 animate-spin"/>}{busy?"Uploading and submitting…":"Submit for review"}</Button></div>
    </form>
   </CardContent></Card>
  </div>
 </SellerLayout></SellerRouteGuard>;
}
