import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowRight, BookOpenCheck, BrainCircuit, Check, ChevronLeft, ChevronRight, Clock3,
  Download, FileCheck2, Headphones, Menu, MessageCircle, Phone, ShieldCheck, Sparkles,
  Star, Target, Users, X, Zap
} from "lucide-react";
import { revivorConfig } from "@/config/revivor";
import products from "@/config/products.json";

type Course = (typeof revivorConfig.courses)[number];
type Product = {
  id: string; course: string; module: string; testType: string; title: string;
  price: number; originalPrice: number; validity: string; slug: string;
};

const PRODUCT_CATALOG = products as Product[];
const featureIcons = [BookOpenCheck, Target, FileCheck2, Headphones, Clock3];
const trackOptions: Record<Course, string[]> = {
  CSEET: ["All Papers"],
  "CS Executive": ["Module 1", "Module 2", "Both Modules"],
  "CS Professional": ["Module 1", "Module 2", "All Modules"],
};
const testTypes = ["Chapter-wise", "Full-syllabus", "Combo"] as const;

function track(term: string) {
  window.dispatchEvent(new CustomEvent("revivor:track", { detail: term }));
  const ga = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof ga === "function") ga("event", term);
  const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq === "function") fbq("trackCustom", term);
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function Countdown() {
  const [remaining, setRemaining] = useState(() => Math.max(0, Date.parse(revivorConfig.offerEndDate) - Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => setRemaining(Math.max(0, Date.parse(revivorConfig.offerEndDate) - Date.now())), 1000);
    return () => window.clearInterval(id);
  }, []);
  const totalSeconds = Math.floor(remaining / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (!remaining) return <span>Offer window has ended.</span>;
  return <span>{d}d {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s</span>;
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"} ${className}`}>{children}</div>;
}

function CourseFinder({ onEnroll }: { onEnroll: (p: Product) => void }) {
  const [course, setCourse] = useState<Course>("CSEET");
  const [module, setModule] = useState(trackOptions.CSEET[0]);
  const [testType, setTestType] = useState<(typeof testTypes)[number]>("Chapter-wise");
  const options = trackOptions[course];
  const match = useMemo(() => PRODUCT_CATALOG.find((p) => p.course === course && p.module === module && p.testType === testType), [course, module, testType]);

  useEffect(() => {
    if (!options.includes(module)) setModule(options[0]);
  }, [course, module, options]);

  return (
    <Reveal>
      <section id="finder" className="scroll-mt-24">
        <div className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-35px_rgba(15,23,42,.35)] md:p-7 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><Sparkles className="size-4" /> Build your test plan</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Find the right series in 3 taps.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Pick your stage, module, and test format. The matching plan is generated from <code className="rounded bg-slate-100 px-1">products.json</code>.</p>
            <div className="mt-6 space-y-5">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">01 · Course</p><div className="flex flex-wrap gap-2">{revivorConfig.courses.map((item) => <button key={item} type="button" aria-pressed={course === item} onClick={() => { setCourse(item); track("course_finder_course"); }} className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${course === item ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300"}`}>{item}</button>)}</div></div>
              <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">02 · Module / paper</p><div className="flex flex-wrap gap-2">{options.map((item) => <button key={item} type="button" aria-pressed={module === item} onClick={() => setModule(item)} className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${module === item ? "border-amber-500 bg-amber-400 text-slate-950" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300"}`}>{item}</button>)}</div></div>
              <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">03 · Test type</p><div className="flex flex-wrap gap-2">{testTypes.map((item) => <button key={item} type="button" aria-pressed={testType === item} onClick={() => setTestType(item)} className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${testType === item ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300"}`}>{item}</button>)}</div></div>
            </div>
          </div>
          <div className="rounded-3xl bg-slate-950 p-6 text-white">
            {match ? <>
              <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">MATCH FOUND</span><span className="text-xs text-slate-400">{match.validity}</span></div>
              <h3 className="mt-5 text-2xl font-bold">{match.title}</h3>
              <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black">{money(match.price)}</span><span className="pb-1 text-sm text-slate-500 line-through">{money(match.originalPrice)}</span></div>
              <p className="mt-2 text-sm text-slate-300">1-year access · {match.module} · {match.testType}</p>
              <button type="button" onClick={() => { track("course_finder_buy"); onEnroll(match); }} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3.5 font-bold text-slate-950 hover:bg-amber-300">Buy this plan <ArrowRight className="size-4" /></button>
              <Link to="/shop/$slug" params={{ slug: match.slug }} onClick={() => track("course_finder_learn_more")} className="mt-3 flex items-center justify-center gap-1 text-sm text-slate-300 hover:text-white">View course details <ArrowRight className="size-4" /></Link>
            </> : <div className="grid min-h-[320px] place-items-center text-center"><div><Zap className="mx-auto size-10 text-amber-400" /><h3 className="mt-4 text-xl font-bold">Add this combination to products.json</h3><p className="mt-2 text-sm text-slate-400">The finder intentionally never invents a plan that is not in the catalog.</p></div></div>}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function FeaturedCarousel({ onEnroll }: { onEnroll: (p: Product) => void }) {
  const featured = PRODUCT_CATALOG.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    if (paused || featured.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % featured.length), 4500);
    return () => window.clearInterval(id);
  }, [paused, featured.length]);
  const p = featured[index];
  if (!p) return null;
  const off = Math.max(0, Math.round((1 - p.price / p.originalPrice) * 100));
  const go = (delta: number) => setIndex((i) => (i + delta + featured.length) % featured.length);
  return (
    <Reveal>
      <section id="series" className="scroll-mt-24">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Featured series</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Pick your next serious prep block.</h2></div><div className="hidden gap-2 sm:flex"><button type="button" aria-label="Previous course" onClick={() => go(-1)} className="rounded-full border border-slate-200 bg-white p-2.5 hover:shadow-md"><ChevronLeft className="size-5" /></button><button type="button" aria-label="Next course" onClick={() => go(1)} className="rounded-full border border-slate-200 bg-white p-2.5 hover:shadow-md"><ChevronRight className="size-5" /></button></div></div>
        <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_80px_-40px_rgba(15,23,42,.35)]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }} onTouchEnd={(e) => { if (touchX.current == null) return; const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}>
          <div className="grid lg:grid-cols-[1.05fr_.95fr]">
            <div className="min-h-[320px] bg-slate-100 p-6 sm:p-10">
              <div className="flex justify-between"><span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black">{off}% OFF</span><span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold shadow-sm"><Star className="size-3.5 fill-amber-400 text-amber-400" /> Configurable rating</span></div>
              <div className="mt-10 grid place-items-center"><div className="relative h-56 w-56 sm:h-64 sm:w-64"><div className="absolute inset-8 rotate-[-8deg] rounded-[34px] border border-slate-300 bg-white shadow-xl" /><div className="absolute inset-4 rotate-[5deg] rounded-[34px] border border-slate-300 bg-slate-50 shadow-xl" /><div className="absolute inset-0 rounded-[34px] border border-slate-900 bg-slate-950 p-6 text-white shadow-2xl"><div className="text-xs font-bold uppercase tracking-widest text-amber-400">REVIVOR</div><div className="mt-5 text-3xl font-black">{p.course}</div><div className="mt-2 text-sm text-slate-300">{p.module}</div><div className="mt-8 h-2 rounded-full bg-amber-400" /><div className="mt-3 h-2 w-2/3 rounded-full bg-slate-700" /></div></div></div>
            </div>
            <div className="p-6 sm:p-10"><p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{p.course} · {p.module}</p><h3 className="mt-3 text-3xl font-black">{p.title}</h3><p className="mt-4 text-sm leading-7 text-slate-600">Practice with a focused test sequence built around chapter-wise or full-syllabus preparation, with expert checking and mentorship.</p><div className="mt-7 flex flex-wrap items-baseline gap-3"><span className="text-4xl font-black">{money(p.price)}</span><span className="text-slate-400 line-through">{money(p.originalPrice)}</span></div><button type="button" onClick={() => { track("featured_buy"); onEnroll(p); }} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 font-bold text-white hover:bg-slate-800">Learn More <ArrowRight className="size-4" /></button></div>
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">{featured.map((item, i) => <button key={item.id} type="button" aria-label={`Show featured course ${i + 1}`} aria-pressed={index === i} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${index === i ? "w-8 bg-slate-900" : "w-2 bg-slate-300"}`} />)}</div>
      </section>
    </Reveal>
  );
}

function LeadForm({ unlocked, setUnlocked }: { unlocked: boolean; setUnlocked: (v: boolean) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", course: "CSEET" as Course });
  const [status, setStatus] = useState<"idle" | "busy" | "success" | "error">("idle");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 2 || !/^[+]?[ds-]{8,16}$/.test(form.phone)) { setStatus("error"); return; }
    setStatus("busy"); track("lead_submit");
    try {
      if (revivorConfig.leadWebhookUrl) {
        const response = await fetch(revivorConfig.leadWebhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, source: "homepage" }) });
        if (!response.ok) throw new Error("Lead webhook failed");
      }
      setStatus("success"); setUnlocked(true); 
    } catch { setStatus("error"); }
  };
  return (
    <Reveal>
      <section id="sample" className="scroll-mt-24">
        <div className="grid gap-6 rounded-[28px] border border-amber-200 bg-amber-50 p-6 sm:p-8 lg:grid-cols-[1fr_.9fr] lg:items-center">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Free sample</p><h2 className="mt-2 text-3xl font-black tracking-tight">Get a real taste before you enroll.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-amber-950/70">Unlock the sample paper after a quick lead form. Delivery can be wired to a webhook from <code className="rounded bg-white/70 px-1">revivor.ts</code>.</p>{unlocked && <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-semibold text-emerald-800">Unlocked. <a href={revivorConfig.freeSampleUrl || "#"} download onClick={(event) => { if (!revivorConfig.freeSampleUrl) event.preventDefault(); else track("free_sample_download"); }} className="ml-1 underline">{revivorConfig.freeSampleUrl ? "Download the free sample" : "Add freeSampleUrl in config to enable the download."}</a></div>}</div>
          <form onSubmit={submit} className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" noValidate><div className="grid gap-4"><label className="text-sm font-semibold">Name<input className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-900" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label className="text-sm font-semibold">Phone<input className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-900" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" required /></label><label className="text-sm font-semibold">Course<select className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-900" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value as Course })}>{revivorConfig.courses.map((c) => <option key={c}>{c}</option>)}</select></label><button disabled={status === "busy"} type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 font-bold text-white hover:bg-slate-800 disabled:opacity-60">{status === "busy" ? "Sending…" : "Unlock Free Sample"} <Download className="size-4" /></button>{status === "error" && <p role="alert" className="text-sm font-semibold text-red-700">Enter a valid name and phone, and check that the lead webhook is configured correctly.</p>}{status === "success" && <p className="text-sm font-semibold text-emerald-700">Request received successfully.</p>}</div></form>
        </div>
      </section>
    </Reveal>
  );
}

function Testimonials() {
  const items = [
    { quote: "The test structure feels closer to an actual attempt than just another PDF dump.", name: "Student feedback placeholder" },
    { quote: "Expert checking and one-on-one guidance are the pieces that make this different.", name: "Student feedback placeholder" },
    { quote: "The plan finder makes it easier to decide what to buy instead of guessing.", name: "Student feedback placeholder" },
  ];
  const [i, setI] = useState(0);
  return <Reveal><section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Student voice</p><h2 className="mt-2 text-3xl font-black">The experience should earn the sale.</h2></div><div className="flex gap-2"><button type="button" aria-label="Previous testimonial" onClick={() => setI((i - 1 + items.length) % items.length)} className="rounded-full border p-2"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Next testimonial" onClick={() => setI((i + 1) % items.length)} className="rounded-full border p-2"><ChevronRight className="size-4" /></button></div></div><div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex gap-1 text-amber-500">{[1,2,3,4,5].map((n) => <Star key={n} className="size-4 fill-current" />)}</div><blockquote className="mt-5 max-w-3xl text-2xl font-bold leading-relaxed">“{items[i].quote}”</blockquote><p className="mt-4 text-sm font-semibold text-slate-500">{items[i].name}</p></div></section></Reveal>;
}

function ExitIntent({ onClose, onSample }: { onClose: () => void; onSample: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="exit-title"><div className="relative w-full max-w-lg rounded-[28px] bg-white p-7 shadow-2xl sm:p-9"><button type="button" aria-label="Close free sample popup" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 hover:bg-slate-100"><X className="size-5" /></button><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Before you go</p><h2 id="exit-title" className="mt-2 text-3xl font-black">Take the free sample paper first.</h2><p className="mt-3 text-sm leading-6 text-slate-600">See how Revivor approaches test practice before making a purchase decision.</p><button type="button" onClick={onSample} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 font-bold text-white">Get free sample <Download className="size-4" /></button></div></div>;
}

function FloatingActions() {
  const number = revivorConfig.whatsappNumber.replace(/D/g, "");
  const call = revivorConfig.clickToCallNumber.replace(/D/g, "");
  const wa = number ? `https://wa.me/${number}?text=${encodeURIComponent("Hi, I want to know about Revivor CS Test Series")}` : "";
  return <><div className="fixed bottom-20 right-4 z-40 hidden flex-col gap-2 sm:flex">{wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" onClick={() => track("whatsapp_click")} className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-3 font-bold text-white shadow-lg"> <MessageCircle className="size-5" /> WhatsApp</a>}{call && <a href={`tel:+${call}`} aria-label="Call Revivor" onClick={() => track("call_click")} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 font-bold text-white shadow-lg"><Phone className="size-5" /> Call</a>}</div><div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 border-t border-slate-200 bg-white p-2 sm:hidden">{wa ? <a href={wa} target="_blank" rel="noreferrer" onClick={() => track("mobile_whatsapp_click")} className="mx-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-3 font-bold text-white"><MessageCircle className="size-4" /> WhatsApp</a> : <span className="mx-1 inline-flex items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">WhatsApp not configured</span>}<a href="#finder" onClick={() => track("mobile_enroll_click")} className="mx-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-3 font-bold text-white">Enroll Now <ArrowRight className="size-4" /></a></div></>;
}

function Home() {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.clientY <= 8 && !sessionStorage.getItem("revivor-exit-shown")) {
        sessionStorage.setItem("revivor-exit-shown", "1");
        setExitOpen(true);
      }
    };
    document.addEventListener("mouseout", handler);
    return () => document.removeEventListener("mouseout", handler);
  }, []);
  const enroll = (p: Product) => navigate({ to: "/checkout/$slug", params: { slug: p.slug } });

  return <main className="min-h-screen bg-[#f8f6f0] pb-16 text-slate-950 sm:pb-0">
    <section className="relative overflow-hidden border-b border-slate-200 bg-[#0b1324] text-white">
      <div className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" /><div className="pointer-events-none absolute bottom-0 left-[-80px] h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      <div className="page-container grid min-h-[640px] items-center gap-10 py-12 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
        <div className="max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-300"><ShieldCheck className="size-3.5" /> CSEET · CS EXECUTIVE · CS PROFESSIONAL</div><h1 className="mt-6 max-w-3xl text-5xl font-black tracking-[-.04em] sm:text-6xl lg:text-7xl">Let's Crack Your CS Exams in the Upcoming Attempt.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{revivorConfig.subline}</p><div className="mt-8 flex flex-wrap gap-3"><a href="#sample" onClick={() => track("hero_start_free_test")} className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3.5 font-black text-slate-950 hover:bg-amber-300">Start Free Test <ArrowRight className="size-4" /></a><a href="#series" onClick={() => track("hero_explore_series")} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 font-bold text-white backdrop-blur hover:bg-white/10">Explore Test Series <ArrowRight className="size-4" /></a></div><div className="mt-6 flex flex-wrap gap-2">{revivorConfig.features.map((feature, i) => { const Icon = featureIcons[i] ?? Check; return <span key={feature} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200"><Icon className="size-3.5 text-amber-300" />{feature}</span>; })}</div></div>
        <div className="relative min-h-[360px] lg:min-h-[460px]"><div className="absolute inset-8 rotate-[-7deg] rounded-[38px] border border-white/10 bg-white/5 backdrop-blur" /><div className="absolute inset-4 rotate-[4deg] rounded-[38px] border border-white/10 bg-white/10 backdrop-blur" /><div className="absolute inset-0 rounded-[38px] border border-white/10 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl"><div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Revivor</p><p className="mt-1 text-sm text-slate-400">Test command center</p></div><div className="grid size-10 place-items-center rounded-2xl bg-amber-400 text-slate-950"><BrainCircuit className="size-5" /></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-xs text-slate-400">Test mode</div><div className="mt-2 text-lg font-bold">Mixed practice</div></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-xs text-slate-400">Validity</div><div className="mt-2 text-lg font-bold">1 Year</div></div></div><div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center justify-between text-xs text-slate-400"><span>Attempt readiness</span><span>Live</span></div><div className="mt-3 h-3 rounded-full bg-white/10"><div className="h-full w-[78%] rounded-full bg-amber-400" /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-xl bg-white/5 p-3">Chapter</span><span className="rounded-xl bg-white/5 p-3">Full-syllabus</span><span className="rounded-xl bg-white/5 p-3">Mentorship</span></div></div></div></div>
      </div>
      <div className="border-t border-white/10"><div className="page-container grid gap-4 py-4 text-sm sm:grid-cols-3"><div className="flex items-center gap-3"><Users className="size-4 text-amber-300" /><span className="font-bold">{revivorConfig.trust.studentCount}</span><span className="text-slate-400">students</span></div><div className="flex items-center gap-3"><Star className="size-4 fill-amber-300 text-amber-300" /><span className="font-bold">{revivorConfig.trust.rating}</span><span className="text-slate-400">{revivorConfig.trust.ratingLabel}</span></div><div className="flex items-center gap-3">{revivorConfig.trust.achievers.length ? revivorConfig.trust.achievers.slice(0, 6).map((src) => <img key={src} src={src} alt="Achiever" className="size-8 rounded-full border border-white/10 object-cover" loading="lazy" />) : <span className="text-slate-400">Add real achiever avatars in config.ts</span>}</div></div></div>
    </section>

    <div className="page-container space-y-20 py-16 sm:py-20">
      <div className="rounded-[28px] border border-amber-200 bg-amber-100/60 p-5 sm:flex sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Limited-time offer</p><p className="mt-1 font-bold">Offer ends in <span className="font-black"><Countdown /></span></p></div><a href="#finder" onClick={() => track("offer_cta")} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white sm:mt-0">See plans <ArrowRight className="size-4" /></a></div>
      <CourseFinder onEnroll={enroll} />
      <FeaturedCarousel onEnroll={enroll} />

      <Reveal><section><div className="grid gap-4 md:grid-cols-4"><a href="#schedule" onClick={() => track("quick_schedule")} className="group rounded-3xl border border-slate-200 bg-white p-5 hover:-translate-y-1 hover:shadow-xl"><Clock3 className="size-5 text-amber-600" /><h3 className="mt-3 font-bold">Schedule & Syllabus</h3><p className="mt-1 text-sm text-slate-500">Jump to prep structure.</p></a><a href="#details" onClick={() => track("quick_details")} className="group rounded-3xl border border-slate-200 bg-white p-5 hover:-translate-y-1 hover:shadow-xl"><FileCheck2 className="size-5 text-amber-600" /><h3 className="mt-3 font-bold">Test Series Details</h3><p className="mt-1 text-sm text-slate-500">See how the system works.</p></a><a href="#finder" onClick={() => track("quick_buy")} className="group rounded-3xl border border-slate-200 bg-white p-5 hover:-translate-y-1 hover:shadow-xl"><Zap className="size-5 text-amber-600" /><h3 className="mt-3 font-bold">How to Buy</h3><p className="mt-1 text-sm text-slate-500">Find a plan and enroll.</p></a><a href="#sample" onClick={() => track("quick_checked_sheets")} className="group rounded-3xl border border-slate-200 bg-white p-5 hover:-translate-y-1 hover:shadow-xl"><Download className="size-5 text-amber-600" /><h3 className="mt-3 font-bold">Checked Sheets</h3><p className="mt-1 text-sm text-slate-500">See the sample before purchase.</p></a></div></section></Reveal>

      <Reveal><section id="details" className="scroll-mt-24"><div className="grid gap-6 lg:grid-cols-2"><div className="rounded-[28px] border border-slate-200 bg-white p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Why Revivor</p><h2 className="mt-2 text-3xl font-black">Practice, feedback, guidance — in one system.</h2><div className="mt-6 space-y-4">{revivorConfig.features.map((f, i) => <div key={f} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Check className="size-5" /></div><div><h3 className="font-bold">{f}</h3><p className="mt-1 text-sm leading-6 text-slate-600">A focused part of the preparation journey, built to help you act on mistakes rather than simply collect attempts.</p></div></div>)}</div></div><div id="schedule" className="rounded-[28px] bg-slate-950 p-6 text-white sm:p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Schedule & syllabus</p><h2 className="mt-2 text-3xl font-black">A simple weekly rhythm.</h2><div className="mt-6 space-y-3">{["Pick the chapter-wise block", "Attempt under timed conditions", "Get expert checking", "Review feedback with mentorship", "Shift to full-syllabus tests"].map((item, i) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/5 p-4"><span className="grid size-9 place-items-center rounded-xl bg-amber-400 font-black text-slate-950">{i + 1}</span><span className="font-semibold">{item}</span></div>)}</div></div></div></section></Reveal>

      <LeadForm unlocked={unlocked} setUnlocked={setUnlocked} />
      <Testimonials />

      <Reveal><section><div className="grid gap-6 rounded-[28px] bg-slate-950 p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Final push</p><h2 className="mt-2 text-3xl font-black">Stop collecting resources. Start measuring readiness.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{revivorConfig.tagline}</p></div><a href="#finder" onClick={() => track("final_cta")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3.5 font-black text-slate-950 hover:bg-amber-300">Choose my test series <ArrowRight className="size-4" /></a></div></section></Reveal>

      <Reveal><section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">FAQ</p><h2 className="mt-2 text-3xl font-black">Questions before you enroll.</h2></div><Accordion type="single" collapsible className="rounded-3xl border border-slate-200 bg-white px-5">{[["How long is validity?","Every plan is configured for 1 Year Validity."],["What does expert checking mean?","Your written-test work can be reviewed by an expert as configured in the selected series."],["Is mentorship included?","Plans can include 1-on-1 Mentorship; confirm the exact scope on the course page before purchasing."],["How do I choose a plan?","Use the 3-step Course Finder. It only shows combinations present in products.json."]].map(([q,a]) => <AccordionItem key={q} value={q}><AccordionTrigger className="text-left font-bold">{q}</AccordionTrigger><AccordionContent className="text-sm leading-6 text-slate-600">{a}</AccordionContent></AccordionItem>)}</Accordion></section></Reveal>
    </div>

    {exitOpen && <ExitIntent onClose={() => setExitOpen(false)} onSample={() => { setExitOpen(false); document.getElementById("sample")?.scrollIntoView({ behavior: "smooth" }); track("exit_sample"); }} />}
    <FloatingActions />
  </main>;
}

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Revivor CS Test Series | CSEET · CS Executive · CS Professional" },
    { name: "description", content: revivorConfig.subline },
    { property: "og:title", content: "Revivor CS Test Series" },
    { property: "og:description", content: revivorConfig.subline },
  ], links: [{ rel: "canonical", href: "/" }] }),
  component: Home,
});
