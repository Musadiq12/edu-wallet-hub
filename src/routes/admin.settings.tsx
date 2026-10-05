import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Database, Globe2, IndianRupee, Link2, MessageCircle, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/admin";
import { SETTING_FIELDS, defaultSettings, saveSettings, settingsQuery, type SiteSettings } from "@/lib/settings";
import { revivorConfig } from "@/config/revivor";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(settingsQuery());
  const [values, setValues] = useState<SiteSettings>(defaultSettings);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data) setValues(data); }, [data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.contactEmail && !/^\S+@\S+\.\S+$/.test(values.contactEmail)) return void toast.error("Enter a valid contact email address.");
    setBusy(true);
    try {
      const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => (data?.[k as keyof SiteSettings] ?? "") !== v)) as Partial<SiteSettings>;
      await saveSettings(changed);
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Site settings saved.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not save the settings."));
    } finally { setBusy(false); }
  };

  const field = (key: keyof SiteSettings) => SETTING_FIELDS.find((f) => f.key === key)!;
  const renderField = (key: keyof SiteSettings) => {
    const f = field(key);
    return <div className="space-y-2" key={f.key}><Label htmlFor={f.key} className="text-sm font-bold text-slate-800">{f.label}</Label><Input id={f.key} className="h-11 rounded-xl border-slate-200 bg-white" value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />{f.help && <p className="text-xs leading-5 text-slate-500">{f.help}</p>}</div>;
  };

  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"><Settings2 className="size-3.5" /> Site configuration</div><h1 className="mt-3 text-3xl font-black tracking-tight">Settings</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">One place to control the public Revivor website. Saved values are read from Supabase by the storefront and checkout.</p></div>
      <div className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 sm:flex"><Database className="size-4" /> Persistent database-backed</div>
    </div>

    {isLoading ? <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> :
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white"><Globe2 className="size-5" /></span><div><h2 className="font-black">Brand & website</h2><p className="text-xs text-slate-500">Identity shown across the public site.</p></div></div><div className="grid gap-5 md:grid-cols-2">{(["brandName","tagline","contactEmail","websiteUrl"] as const).map(renderField)}</div></section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-400 text-slate-950"><IndianRupee className="size-5" /></span><div><h2 className="font-black">Payment & delivery</h2><p className="text-xs text-slate-500">Checkout reads these values live.</p></div></div><div className="grid gap-5 md:grid-cols-2">{(["upiId","upiPayeeName","qrCodeUrl","deliveryEstimate"] as const).map(renderField)}</div></section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-500 text-white"><MessageCircle className="size-5" /></span><div><h2 className="font-black">Contact & social</h2><p className="text-xs text-slate-500">Used by WhatsApp, contact links and footer actions.</p></div></div><div className="grid gap-5 md:grid-cols-2">{(["whatsappNumber","instagram","telegram","youtube"] as const).map(renderField)}</div></section>

      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-7"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 text-amber-400" /><div><h2 className="font-black">Single source of truth</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">Do not edit payment/contact values inside homepage code. Admin changes are stored in the <code className="rounded bg-white/10 px-1.5 py-0.5">site_settings</code> table and fetched by the public site at runtime.</p><p className="mt-3 flex items-center gap-1 text-xs font-bold text-amber-300"><Link2 className="size-3.5" /> {revivorConfig.brandName}</p></div></div></section>

      <div className="sticky bottom-4 z-20 flex justify-end"><Button type="submit" className="h-12 rounded-xl bg-slate-950 px-6 font-black shadow-xl hover:bg-slate-800" disabled={busy}><Save className="mr-2 size-4" />{busy ? "Saving…" : "Save changes"}</Button></div>
    </form>}
  </div>;
}
