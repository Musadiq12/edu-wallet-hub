import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RevivorSeries = {
  id: string; course: string; title: string; slug: string; subject: string | null;
  test_type: string; price: number; discount_price: number | null; validity_days: number | null;
  features: string[]; thumbnail_url: string | null; status: string; sort_order: number;
};
export type WhyCard = { id:string; title:string; description:string; icon:string|null; sort_order:number };
export type ScheduleStep = { id:string; title:string; description:string; icon:string|null; sort_order:number };
export type Faq = { id:string; question:string; answer:string; sort_order:number };
export type Testimonial = { id:string; name:string; photo_url:string|null; course:string|null; rating:number|null; testimonial:string; sort_order:number };
export type Achiever = { id:string; name:string|null; photo_url:string; alt_text:string|null; sort_order:number };
export type Offer = { id:boolean; text:string|null; link:string|null; end_at:string|null; is_enabled:boolean };
export type HomepageSection = { id:string; section_key:string; title:string|null; subtitle:string|null; content:Record<string,unknown>; is_visible:boolean; sort_order:number };

export const revivorSeriesQuery = () => queryOptions({
  queryKey:["revivor-series"],
  staleTime:30_000,
  queryFn:async():Promise<RevivorSeries[]>=>{
    const {data,error}=await supabase.from("test_series").select("id,course,title,slug,subject,test_type,price,discount_price,validity_days,features,thumbnail_url,status,sort_order").eq("status","published").order("sort_order").order("created_at",{ascending:false});
    if(error) throw error;
    return (data??[]).map((x:any)=>({...x,price:Number(x.price),discount_price:x.discount_price==null?null:Number(x.discount_price),features:Array.isArray(x.features)?x.features:[]}));
  }
});
export const whyCardsQuery=()=>queryOptions({queryKey:["revivor-why"],staleTime:30_000,queryFn:async()=>{const {data,error}=await supabase.from("why_revivor_cards").select("id,title,description,icon,sort_order").eq("is_visible",true).order("sort_order");if(error)throw error;return data??[];}});
export const scheduleQuery=()=>queryOptions({queryKey:["revivor-schedule"],staleTime:30_000,queryFn:async()=>{const {data,error}=await supabase.from("schedule_steps").select("id,title,description,icon,sort_order").eq("is_visible",true).order("sort_order");if(error)throw error;return data??[];}});
export const faqQuery=()=>queryOptions({queryKey:["revivor-faq"],staleTime:30_000,queryFn:async()=>{const {data,error}=await supabase.from("faqs").select("id,question,answer,sort_order").eq("is_visible",true).order("sort_order");if(error)throw error;return data??[];}});
export const testimonialQuery=()=>queryOptions({queryKey:["revivor-testimonials"],staleTime:30_000,queryFn:async()=>{const {data,error}=await supabase.from("testimonials").select("id,name,photo_url,course,rating,testimonial,sort_order").eq("is_visible",true).eq("is_approved",true).order("sort_order");if(error)throw error;return data??[];}});
export const achieverQuery=()=>queryOptions({queryKey:["revivor-achievers"],staleTime:30_000,queryFn:async()=>{const {data,error}=await supabase.from("achiever_avatars").select("id,name,photo_url,alt_text,sort_order").eq("is_visible",true).order("sort_order");if(error)throw error;return data??[];}});
export const offerQuery=()=>queryOptions({queryKey:["revivor-offer"],staleTime:15_000,queryFn:async():Promise<Offer|null>=>{const {data,error}=await supabase.from("offer_settings").select("id,text,link,end_at,is_enabled").eq("id",true).maybeSingle();if(error)throw error;return data??null;}});
export const homepageSectionsQuery=()=>queryOptions({queryKey:["revivor-homepage-sections"],staleTime:30_000,queryFn:async()=>{const {data,error}=await supabase.from("homepage_sections").select("id,section_key,title,subtitle,content,is_visible,sort_order").eq("is_visible",true).order("sort_order");if(error)throw error;return (data??[]) as HomepageSection[];}});
