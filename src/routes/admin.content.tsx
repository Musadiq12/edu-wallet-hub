import { useEffect, useState } from "react";\nconst db = supabase as any;\nimport { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/admin";

export const Route = createFileRoute("/admin/content")({ component: AdminContent });

type Row = { id:string; [key:string]: any };

function useRows(table:string, select:string, order="sort_order") {
  return useQuery({
    queryKey:["admin-content",table],
    queryFn:async():Promise<Row[]>=>{
      const {data,error}=await db.from(table as any).select(select).order(order,{ascending:true});
      if(error) throw error;
      return (data??[]) as Row[];
    }
  });
}

function EditableList({ table, title, description, fields, rows, queryKey, defaults }: {
  table:string; title:string; description:string; fields:{key:string;label:string;area?:boolean}[]; rows:Row[]; queryKey:string[]; defaults:Record<string,any>;
}) {
  const qc=useQueryClient();
  const [drafts,setDrafts]=useState<Record<string,Row>>({});
  useEffect(()=>{setDrafts(Object.fromEntries(rows.map(r=>[r.id,{...r}])))},[rows]);
  const save=async(id:string)=>{
    const row=drafts[id]; if(!row)return;
    const payload={...row}; delete payload.id;
    const {error}=await db.from(table as any).update(payload).eq("id",id);
    if(error){toast.error(friendlyError(error,"Could not save this item."));return;}
    await qc.invalidateQueries({queryKey}); toast.success("Saved.");
  };
  const add=async()=>{
    const {data,error}=await db.from(table as any).insert({...defaults}).select().single();
    if(error){toast.error(friendlyError(error,"Could not add this item."));return;}
    await qc.invalidateQueries({queryKey});
    if(data) setDrafts(d=>({...d,[data.id]:data}));
  };
  const remove=async(id:string)=>{
    if(!window.confirm("Delete this item? This cannot be undone.")) return;
    const {error}=await db.from(table as any).delete().eq("id",id);
    if(error){toast.error(friendlyError(error,"Could not delete this item."));return;}
    await qc.invalidateQueries({queryKey}); toast.success("Deleted.");
  };
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div><Button size="sm" onClick={()=>void add()}><Plus className="mr-1 size-4"/>Add</Button></div>
    <div className="mt-6 space-y-4">
      {rows.length===0 && <p className="rounded-2xl border border-dashed p-5 text-sm text-slate-500">No items yet.</p>}
      {rows.map((source)=>{
        const row=drafts[source.id]??source;
        return <div key={source.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(f=><div key={f.key} className={f.area?"md:col-span-2":""}><label className="text-xs font-bold text-slate-600">{f.label}</label>{f.area?<Textarea className="mt-1.5 min-h-24" value={row[f.key]??""} onChange={e=>setDrafts(d=>({...d,[row.id]:{...row,[f.key]:e.target.value}}))}/>:<Input className="mt-1.5 h-10" value={row[f.key]??""} onChange={e=>setDrafts(d=>({...d,[row.id]:{...row,[f.key]:e.target.value}}))}/>}</div>)}
            {Object.prototype.hasOwnProperty.call(row,"is_visible") && <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={!!row.is_visible} onCheckedChange={v=>setDrafts(d=>({...d,[row.id]:{...row,is_visible:v}}))}/> Visible</label>}
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={()=>void remove(row.id)}><Trash2 className="mr-1 size-4"/>Delete</Button><Button size="sm" onClick={()=>void save(row.id)}><Save className="mr-1 size-4"/>Save</Button></div>
        </div>
      })}
    </div>
  </section>;
}

function AdminContent(){
  const why=useRows("why_revivor_cards","id,title,description,icon,is_visible,sort_order");
  const schedule=useRows("schedule_steps","id,title,description,icon,is_visible,sort_order");
  const faq=useRows("faqs","id,question,answer,is_visible,sort_order");
  const testimonials=useRows("testimonials","id,name,photo_url,course,rating,testimonial,is_approved,is_visible,sort_order");
  const achievers=useRows("achiever_avatars","id,name,photo_url,alt_text,is_visible,sort_order");
  const offer=useQuery({queryKey:["admin-offer"],queryFn:async()=>{const {data,error}=await db.from("offer_settings").select("id,text,link,end_at,is_enabled").eq("id",true).single();if(error)throw error;return data;}});
  const [offerDraft,setOfferDraft]=useState<any>(null);
  useEffect(()=>{if(offer.data)setOfferDraft(offer.data)},[offer.data]);
  const saveOffer=async()=>{if(!offerDraft)return;const {error}=await db.from("offer_settings").upsert({...offerDraft,id:true});if(error){toast.error(friendlyError(error,"Could not save the offer."));return;}toast.success("Offer saved.");};
  return <div className="space-y-7">
    <div><h1 className="text-3xl font-black tracking-tight">Homepage Content</h1><p className="mt-1 text-sm text-slate-500">Every item below is stored in Supabase and rendered by the public Revivor site.</p></div>
    <EditableList table="why_revivor_cards" title="Why Revivor" description="Five unique value cards with editable copy and icon names." fields={[{key:"title",label:"Title"},{key:"icon",label:"Icon name"},{key:"description",label:"Description",area:true},{key:"sort_order",label:"Sort order"}]} rows={why.data??[]} queryKey={["admin-content","why_revivor_cards"]} defaults={{title:"New benefit",description:"",icon:"Check",is_visible:true,sort_order:(why.data?.length??0)+1}} />
    <EditableList table="schedule_steps" title="Schedule steps" description="Editable preparation flow." fields={[{key:"title",label:"Title"},{key:"icon",label:"Icon / step"},{key:"description",label:"Description",area:true},{key:"sort_order",label:"Sort order"}]} rows={schedule.data??[]} queryKey={["admin-content","schedule_steps"]} defaults={{title:"New step",description:"",icon:"",is_visible:true,sort_order:(schedule.data?.length??0)+1}} />
    <EditableList table="faqs" title="FAQs" description="Questions and complete answers shown publicly." fields={[{key:"question",label:"Question"},{key:"sort_order",label:"Sort order"},{key:"answer",label:"Answer",area:true}]} rows={faq.data??[]} queryKey={["admin-content","faqs"]} defaults={{question:"New question",answer:"",is_visible:true,sort_order:(faq.data?.length??0)+1}} />
    <EditableList table="testimonials" title="Testimonials" description="Only approved and visible testimonials appear on the public site." fields={[{key:"name",label:"Name"},{key:"course",label:"Course"},{key:"rating",label:"Rating (0–5)"},{key:"photo_url",label:"Photo URL"},{key:"testimonial",label:"Testimonial",area:true},{key:"sort_order",label:"Sort order"}]} rows={testimonials.data??[]} queryKey={["admin-content","testimonials"]} defaults={{name:"",course:"",rating:5,photo_url:"",testimonial:"",is_approved:false,is_visible:true,sort_order:(testimonials.data?.length??0)+1}} />
    <EditableList table="achiever_avatars" title="Achiever avatars" description="Add real image URLs; the public gallery stays hidden when empty." fields={[{key:"name",label:"Name"},{key:"photo_url",label:"Photo URL"},{key:"alt_text",label:"Alt text"},{key:"sort_order",label:"Sort order"}]} rows={achievers.data??[]} queryKey={["admin-content","achiever_avatars"]} defaults={{name:"",photo_url:"",alt_text:"Revivor achiever",is_visible:true,sort_order:(achievers.data?.length??0)+1}} />
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="font-black">Offer & countdown</h2><p className="mt-1 text-xs text-slate-500">The banner automatically disappears after the configured end time.</p>
      {offerDraft && <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div><label className="text-xs font-bold">Offer text</label><Input className="mt-1.5" value={offerDraft.text??""} onChange={e=>setOfferDraft({...offerDraft,text:e.target.value})}/></div>
        <div><label className="text-xs font-bold">Link</label><Input className="mt-1.5" value={offerDraft.link??""} onChange={e=>setOfferDraft({...offerDraft,link:e.target.value})}/></div>
        <div><label className="text-xs font-bold">End date & time</label><Input type="datetime-local" className="mt-1.5" value={offerDraft.end_at?new Date(offerDraft.end_at).toISOString().slice(0,16):""} onChange={e=>setOfferDraft({...offerDraft,end_at:e.target.value?new Date(e.target.value).toISOString():null})}/></div>
        <label className="flex items-center gap-2 pt-7 text-sm font-semibold"><Switch checked={!!offerDraft.is_enabled} onCheckedChange={v=>setOfferDraft({...offerDraft,is_enabled:v})}/> Enabled</label>
      </div>}
      <div className="mt-5 flex justify-end"><Button onClick={()=>void saveOffer()}><Save className="mr-1 size-4"/>Save offer</Button></div>
    </section>
  </div>;
}
