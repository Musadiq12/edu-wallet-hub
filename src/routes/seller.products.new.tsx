import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, FileText, ImagePlus, Loader2, ShieldCheck, UploadCloud, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { sellerAccessToken } from "@/lib/seller-workspace";
import { sellerCreatePrivateUploadPath, sellerCreateProduct } from "@/lib/seller-workspace.server-fns";
import { supabase } from "@/integrations/supabase/client";

export const Route=createFileRoute("/seller/products/new")({component:NewSellerProduct});
const exams=["NEET","JEE","UPSC","SSC","CGL","CLAT","CA","Other"] as const;
const categories=[
 ["3a642021-05c1-4c2a-bc4d-6d3c7b5c6b6a","NEET"],
 ["51c4edb1-0ac0-44cd-bcef-99835648aa3a","JEE"],
 ["ba141727-d59b-42ea-b6ce-925b4c7ec34a","UPSC"],
 ["65defbd0-0e6c-4019-9842-a9b4afcf5b0c","SSC CGL"],
 ["f7fb3a0f-7819-4034-ba13-871517741477","Banking"],
 ["a79d40a2-ac36-43ba-a5c0-d8e74d08254a","CLAT"],
 ["2f4d397d-3868-4e43-a3ce-4a08588b40d8","CA"],
 ["44a493ab-8a74-4010-9d95-71c56284ddf2","Study Notes"],
 ["dc16bca8-95d1-4af6-b100-899025718e59","Exam Guide"],
 ["c7f04a19-1e37-4259-ae9d-168fb5eedd93","Guess Paper"],
 ["d3cc142c-2693-49e8-8517-37a8b29cc660","Solved Papers"],
 ["2e6313ee-3da1-4a54-93ae-3500ebc4a35a","Previous Year Papers"],
 ["8b39909b-4420-42cf-b87a-33bfcaf56f7a","Assignments"],
 ["35c2d793-02e2-4c46-930c-569371b8ad59","Books / E-Books"],
 ["27fd9e5a-9d6d-4830-b164-c4d464bfa5cd","Practice Material"],
] as const;
const MAX_PDF=20*1024*1024,MAX_PREVIEW=5*1024*1024;
type Kind="pdf"|"preview";
function Section({number,title,description,children}:{number:string;title:string;description:string;children:React.ReactNode}){
 return <section className="space-y-4"><div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{number}</span><div><h3 className="font-semibold tracking-tight">{title}</h3><p className="mt-0.5 text-sm text-muted-foreground">{description}</p></div></div><div className="space-y-4 sm:pl-11">{children}</div></section>;
}
function Field({label,htmlFor,required,help,children}:{label:string;htmlFor:string;required?:boolean;help?:string;children:React.ReactNode}){
 return <div className="min-w-0 space-y-2"><Label htmlFor={htmlFor} className="text-sm font-medium">{label}{required&&<span className="ml-1 text-destructive">*</span>}</Label>{children}{help&&<p className="text-xs leading-5 text-muted-foreground">{help}</p>}</div>;
}
function NewSellerProduct(){
 const navigate=useNavigate(),qc=useQueryClient(),lock=useRef(false);
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[included,setIncluded]=useState(""),[categoryId,setCategoryId]=useState(""),[exam,setExam]=useState(""),[subject,setSubject]=useState(""),[price,setPrice]=useState(""),[discountedPrice,setDiscountedPrice]=useState(""),[pageCount,setPageCount]=useState(""),[coverUrl,setCoverUrl]=useState(""),[rightsConfirmed,setRightsConfirmed]=useState(false);
 const [pdf,setPdf]=useState<File|null>(null),[preview,setPreview]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const pick=(file:File|null,kind:Kind)=>{
  if(!file){if(kind==="pdf")setPdf(null);else setPreview(null);return;}
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
  const amount=Number(price),discountAmount=discountedPrice.trim()===""?null:Number(discountedPrice);
  if(title.trim().length<5||title.trim().length>120){setError("Title must be 5–120 characters.");return;}
  if(description.trim().length<20||description.trim().length>2000){setError("Description must be 20–2,000 characters.");return;}
  if(included.trim().length<5||included.trim().length>2000){setError("Explain what the product includes (5–2,000 characters).");return;}
  if(!categoryId){setError("Choose a category.");return;}
  if(!/^[1-9]\d{0,4}$/.test(pageCount)){setError("Enter the PDF page count (1–99,999).");return;}
  if(!rightsConfirmed){setError("Confirm that you have the right to sell and distribute this material.");return;}
  if(coverUrl.trim()&&!/^https:\/\/drive\.google\.com\/(?:file\/d\/[A-Za-z0-9_-]{10,}|open\?id=[A-Za-z0-9_-]{10,})/i.test(coverUrl.trim())){setError("Enter a share link from Google Drive.");return;}
  if(!exams.includes(exam as typeof exams[number])){setError("Choose an exam or course.");return;}
  if(subject.trim().length<2||subject.trim().length>60){setError("Subject must be 2–60 characters.");return;}
  if(!/^(?:\d{1,4})(?:\.\d{1,2})?$/.test(price)||!Number.isFinite(amount)||amount<10||amount>5000){setError("Enter a price between ₹10 and ₹5,000 with up to 2 decimals.");return;}
  if(discountedPrice.trim()!==""&&(!/^(?:\\d{1,4})(?:\\.\\d{1,2})?$/.test(discountedPrice)||!Number.isFinite(discountAmount)||discountAmount!<1||discountAmount!>=amount)){setError("Discounted price must be at least ₹1 and lower than the original price.");return;}\n  if(!pdf){setError("Upload your main notes PDF.");return;}
  lock.current=true;setBusy(true);setError("");
  let mainPath:string|null=null,previewPath:string|null=null;
  try{
   const token=await sellerAccessToken();
   mainPath=await upload(pdf,"pdf",token);
   if(preview)previewPath=await upload(preview,"preview",token);
   await sellerCreateProduct({data:{accessToken:token,title:title.trim(),description:description.trim(),whatsIncluded:included.trim(),categoryId:categoryId||null,pageCount:Number(pageCount),coverSourceUrl:coverUrl.trim()||null,rightsConfirmed,exam,subject:subject.trim(),price:amount,discountedPrice:discountAmount,pdfPath:mainPath,previewPath}});
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
  <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
   <div className="space-y-2"><Button variant="ghost" size="sm" asChild className="-ml-3 h-8 px-3 text-muted-foreground"><Link to="/seller/products"><ArrowLeft className="mr-1 size-4"/>Back to products</Link></Button><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Seller studio</p><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add a study resource</h2><p className="max-w-2xl text-sm leading-6 text-muted-foreground">Share your material with students. Add the essentials below; your listing will go live after review.</p></div>
   <form onSubmit={submit} className="space-y-6">
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-7">
     <Section number="01" title="About your resource" description="Give students a clear idea of what they are getting.">
      <Field label="Product title" htmlFor="seller-title" required help="Use a specific title students can find easily."><Input id="seller-title" maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. UPSC Polity — Complete Revision Notes" required className="h-11"/></Field>
      <Field label="Description" htmlFor="seller-description" required help="20–2,000 characters. Explain the purpose and who this resource is for."><Textarea id="seller-description" rows={3} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What will students learn? What makes these notes useful?" required className="min-h-24 resize-y"/></Field>
      <Field label="What's included" htmlFor="seller-included" required help="Mention chapters, solved papers, answer keys, topics or other contents. This appears on the product page."><Textarea id="seller-included" rows={3} maxLength={2000} value={included} onChange={e=>setIncluded(e.target.value)} placeholder={"Complete chapter-wise notes\nPrevious-year questions\nAnswer key and explanations"} required className="min-h-24 resize-y"/></Field>
     </Section>
     <div className="my-7 border-t"/>
     <Section number="02" title="Course and pricing" description="Choose a category and set your original price. Add a sale price only if you want to offer a discount.">
      <div className="grid gap-4 sm:grid-cols-2">
       <Field label="Category" htmlFor="seller-category" required help="The store category used to organise your listing."><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger id="seller-category" className="h-11"><SelectValue placeholder="Select category"/></SelectTrigger><SelectContent>{categories.map(([id,label])=><SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></Field>
       <Field label="Exam / course" htmlFor="seller-exam" required><Select value={exam} onValueChange={setExam}><SelectTrigger id="seller-exam" className="h-11"><SelectValue placeholder="Select exam or course"/></SelectTrigger><SelectContent>{exams.map(item=><SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
       <Field label="Subject" htmlFor="seller-subject" required help="e.g. Indian Polity, Physics, Accounting"><Input id="seller-subject" maxLength={60} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Enter subject" required className="h-11"/></Field>
       <Field label="Original price" htmlFor="seller-price" required help="The regular price before any discount. ₹10–₹5,000."><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span><Input id="seller-price" type="number" min="10" max="5000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="199" required className="h-11 pl-8"/></div></Field><Field label="Discounted price (optional)" htmlFor="seller-discount-price" help="The amount customers actually pay. Leave blank to sell at the original price."><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span><Input id="seller-discount-price" type="number" min="1" max="5000" step="0.01" value={discountedPrice} onChange={e=>setDiscountedPrice(e.target.value)} placeholder="149" className="h-11 pl-8"/></div>{price&&discountedPrice&&Number(discountedPrice)>0&&Number(discountedPrice)<Number(price)&&<p className="mt-1 text-xs font-medium text-emerald-700">Customer saves {Math.round((1-Number(discountedPrice)/Number(price))*100)}% · pays ₹{Number(discountedPrice).toFixed(2)}</p>}</Field>
      </div>
     </Section>
     <div className="my-7 border-t"/>
     <Section number="03" title="Upload your files" description="Your main PDF is required. A sample preview is optional.">
      <div className="space-y-2"><Label htmlFor="seller-pdf">Study notes PDF <span className="text-destructive">*</span></Label><label htmlFor="seller-pdf" className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><UploadCloud className="size-5"/></span><span className="mt-3 text-sm font-semibold">{pdf?.name??"Choose your PDF"}</span><span className="mt-1 text-xs text-muted-foreground">PDF format · Up to 20 MB</span><span className="mt-3 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium group-hover:border-primary/30">Browse files</span></label><input id="seller-pdf" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={e=>pick(e.target.files?.[0]??null,"pdf")}/>{pdf&&<div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><FileText className="size-4 shrink-0 text-primary"/><span className="min-w-0 flex-1 truncate">{pdf.name}</span><span className="text-xs text-muted-foreground">{(pdf.size/1024/1024).toFixed(2)} MB</span><button type="button" aria-label="Remove main PDF" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={()=>setPdf(null)}><X className="size-4"/></button></div>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Number of pages" htmlFor="seller-page-count" required help="Total pages in your main PDF."><Input id="seller-page-count" type="number" min="1" max="99999" step="1" value={pageCount} onChange={e=>setPageCount(e.target.value)} placeholder="e.g. 120" required className="h-11"/></Field><Field label="Sample preview PDF" htmlFor="seller-preview" help="Optional sample pages for customers · Up to 5 MB."><Input id="seller-preview" type="file" accept="application/pdf,.pdf" onChange={e=>pick(e.target.files?.[0]??null,"preview")} className="h-11 file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"/>{preview&&<div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="size-4"/><span className="min-w-0 flex-1 truncate">{preview.name} · {(preview.size/1024/1024).toFixed(2)} MB</span><button type="button" className="text-destructive" onClick={()=>setPreview(null)}>Remove</button></div>}</Field></div>
     </Section>
     <div className="my-7 border-t"/>
     <Section number="04" title="Cover image and confirmation" description="Suggest a cover image and confirm your right to distribute the material.">
      <Field label="Cover image link" htmlFor="seller-cover-url" help="Optional Google Drive image link. Share it as “Anyone with the link — Viewer”. Admins preview it and choose whether to publish it."><div className="relative"><ImagePlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input id="seller-cover-url" type="url" value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" className="h-11 pl-9"/></div></Field>
      <div className="flex items-start gap-3 rounded-xl border p-4"><Checkbox id="seller-rights-confirmed" checked={rightsConfirmed} onCheckedChange={value=>setRightsConfirmed(value===true)} className="mt-0.5"/><div className="space-y-1"><Label htmlFor="seller-rights-confirmed" className="cursor-pointer text-sm font-medium leading-5">I have the right to sell and distribute this material. <span className="text-destructive">*</span></Label><p className="text-xs leading-5 text-muted-foreground">I confirm this material is not copied or unlawfully shared, the listing details are accurate, and I agree to the Seller Terms & Conditions.</p></div></div>
     </Section>
    </div>
    <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-4 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary"/><p className="leading-5 text-muted-foreground"><span className="font-medium text-foreground">What happens next?</span> Your listing stays private until an administrator reviews and approves it. You can track the decision from My products.</p></div>
    {error&&<div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0"/>{error}</div>}
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end"><Button type="button" variant="outline" asChild disabled={busy}><Link to="/seller/products">Cancel</Link></Button><Button type="submit" disabled={busy} className="min-w-44">{busy&&<Loader2 className="mr-2 size-4 animate-spin"/>}{busy?"Uploading and submitting…":"Submit for review"}</Button></div>
   </form>
  </div>
 </SellerLayout></SellerRouteGuard>;
}
