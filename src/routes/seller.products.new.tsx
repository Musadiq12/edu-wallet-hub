import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[included,setIncluded]=useState(""),[categoryId,setCategoryId]=useState(""),[exam,setExam]=useState(""),[subject,setSubject]=useState(""),[price,setPrice]=useState(""),[pageCount,setPageCount]=useState(""),[coverUrl,setCoverUrl]=useState(""),[rightsConfirmed,setRightsConfirmed]=useState(false);
 const [pdf,setPdf]=useState<File|null>(null),[preview,setPreview]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const pick=(file:File|null,kind:Kind)=>{
  if(!file){if(kind==="pdf"){setPdf(null);}else{setPreview(null);}return;}
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
  if(title.trim().length<5||title.trim().length>120){setError("Title must be 5–120 characters.");return;}
  if(description.trim().length<20||description.trim().length>2000){setError("Description must be 20–2000 characters.");return;}
  if(included.trim().length<5||included.trim().length>2000){setError("Explain what the product includes (5–2,000 characters).");return;}
  if(!/^[1-9]\d{0,4}$/.test(pageCount)){setError("Enter the PDF page count (1–99,999).");return;}
  if(!rightsConfirmed){setError("Confirm that you have the right to sell and distribute this material.");return;}
  if(coverUrl.trim()&&!/^https:\/\/drive\.google\.com\/(?:file\/d\/[A-Za-z0-9_-]{10,}|open\?id=[A-Za-z0-9_-]{10,})/i.test(coverUrl.trim())){setError("Enter a share link from Google Drive.");return;}
  if(!exams.includes(exam as typeof exams[number])){setError("Choose an exam.");return;}
  if(subject.trim().length<2||subject.trim().length>60){setError("Subject must be 2–60 characters.");return;}
  if(!/^(?:\d{1,4})(?:\.\d{1,2})?$/.test(price)||!Number.isFinite(amount)||amount<10||amount>5000){setError("Enter a price between ₹10 and ₹5,000 with up to 2 decimals.");return;}
  if(!pdf){setError("Upload your main notes PDF.");return;}
  lock.current=true;setBusy(true);setError("");
  let mainPath:string|null=null,previewPath:string|null=null;
  try{
   const token=await sellerAccessToken();
   mainPath=await upload(pdf,"pdf",token);
   if(preview)previewPath=await upload(preview,"preview",token);
   await sellerCreateProduct({data:{accessToken:token,title:title.trim(),description:description.trim(),whatsIncluded:included.trim(),categoryId:categoryId||null,pageCount:Number(pageCount),coverSourceUrl:coverUrl.trim()||null,rightsConfirmed,exam,subject:subject.trim(),price:amount,pdfPath:mainPath,previewPath}});
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
     <div className="space-y-2"><Label htmlFor="seller-included">What it includes <span className="text-destructive">*</span></Label><Textarea id="seller-included" rows={4} maxLength={2000} value={included} onChange={e=>setIncluded(e.target.value)} placeholder="List chapters, topics, solved papers, answer keys, question sets, and other contents." required/><p className="text-xs text-muted-foreground">Be specific. This appears on the product page after approval.</p></div>
     <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="seller-category">Category</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger id="seller-category"><SelectValue placeholder="Select category"/></SelectTrigger><SelectContent>{[["3a642021-05c1-4c2a-bc4d-6d3c7b5c6b6a","NEET"],["51c4edb1-0ac0-44cd-bcef-99835648aa3a","JEE"],["ba141727-d59b-42ea-b6ce-925b4c7ec34a","UPSC"],["65defbd0-0e6c-4019-9842-a9b4afcf5b0c","SSC CGL"],["f7fb3a0f-7819-4034-ba13-871517741477","Banking"],["a79d40a2-ac36-43ba-a5c0-d8e74d08254a","CLAT"],["2f4d397d-3868-4e43-a3ce-4a08588b40d8","CA"],["44a493ab-8a74-4010-9d95-71c56284ddf2","Study Notes"],["dc16bca8-95d1-4af6-b100-899025718e59","Exam Guide"],["c7f04a19-1e37-4259-ae9d-168fb5eedd93","Guess Paper"],["d3cc142c-2693-49e8-8517-37a8b29cc660","Solved Papers"],["2e6313ee-3da1-4a54-93ae-3500ebc4a35a","Previous Year Papers"],["8b39909b-4420-42cf-b87a-33bfcaf56f7a","Assignments"],["35c2d793-02e2-4c46-930c-569371b8ad59","Books / E-Books"],["27fd9e5a-9d6d-4830-b164-c4d464bfa5cd","Practice Material"]].map(([id,label])=><SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="seller-course">Course / Exam</Label><Select value={exam} onValueChange={setExam}><SelectTrigger id="seller-course"><SelectValue placeholder="Select course or exam"/></SelectTrigger><SelectContent>{exams.map(item=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div>
     <div className="space-y-2"><Label htmlFor="seller-subject">Subject</Label><Input id="seller-subject" maxLength={60} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Indian Polity" required/></div>
     <div className="space-y-2"><Label htmlFor="seller-price">Price (INR ₹)</Label>
      <div className="space-y-2"><Label htmlFor="seller-exam">Exam</Label><Select value={exam} onValueChange={setExam}><SelectTrigger id="seller-exam"><SelectValue placeholder="Select exam"/></SelectTrigger><SelectContent>{exams.map(item=><SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="seller-subject">Subject</Label><Input id="seller-subject" maxLength={60} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Indian Polity" required/></div>
     </div>
     <div className="space-y-2"><Label htmlFor="seller-price">Price (INR ₹)</Label><Input id="seller-price" type="number" min="10" max="5000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="99.00" required/><p className="text-xs text-muted-foreground">₹10–₹5,000; up to two decimal places.</p></div>
     <div className="space-y-2"><Label htmlFor="seller-pdf">Notes PDF <span className="text-destructive">*</span></Label><label htmlFor="seller-pdf" className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-7 text-center hover:bg-muted/40"><UploadCloud className="size-7 text-muted-foreground"/><span className="mt-2 text-sm font-medium">{pdf?.name??"Choose your notes PDF"}</span><span className="mt-1 text-xs text-muted-foreground">PDF only · Maximum 20 MB</span></label><input id="seller-pdf" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e=>pick(e.target.files?.[0]??null,"pdf")}/>{pdf&&<div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="size-4"/>{(pdf.size/1024/1024).toFixed(2)} MB <button type="button" className="ml-auto text-destructive underline" onClick={()=>setPdf(null)}>Remove</button></div>}</div>
     <div className="space-y-2"><Label htmlFor="seller-page-count">PDF page count</Label><Input id="seller-page-count" type="number" min="1" max="99999" step="1" value={pageCount} onChange={e=>setPageCount(e.target.value)} placeholder="e.g. 120" required/></div>
     <div className="space-y-2"><Label htmlFor="seller-cover-url">Proposed cover image (Google Drive link, optional)</Label><Input id="seller-cover-url" type="url" value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…/view"/><p className="text-xs text-muted-foreground">Share with “Anyone with the link — Viewer”. Admins can preview it; it is never published automatically.</p></div>
     <div className="space-y-2"><Label htmlFor="seller-preview">Preview PDF (optional)</Label><Input id="seller-preview" type="file" accept="application/pdf,.pdf" onChange={e=>pick(e.target.files?.[0]??null,"preview")}/><p className="text-xs text-muted-foreground">Optional sample pages for customers · Maximum 5 MB</p>{preview&&<p className="text-xs text-muted-foreground">{preview.name} · {(preview.size/1024/1024).toFixed(2)} MB</p>}</div>
     <div className="flex items-start gap-3 rounded-lg border border-border p-3"><Checkbox id="seller-rights-confirmed" checked={rightsConfirmed} onCheckedChange={value=>setRightsConfirmed(value===true)}/><Label htmlFor="seller-rights-confirmed" className="text-sm font-normal leading-5">I confirm that I own this material or have permission to sell and distribute it, that it is not copied or unlawfully shared, and that the product details are accurate. I agree to the Seller Terms &amp; Conditions. <span className="text-destructive">*</span></Label></div>
     <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300"/><p>Your note stays hidden until an administrator reviews and approves it.</p></div>
     {error&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
     <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" asChild disabled={busy}><Link to="/seller/products">Cancel</Link></Button><Button type="submit" disabled={busy}>{busy&&<Loader2 className="size-4 animate-spin"/>}{busy?"Uploading and submitting…":"Submit for review"}</Button></div>
    </form>
   </CardContent></Card>
  </div>
 </SellerLayout></SellerRouteGuard>;
}
