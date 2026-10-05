import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/admin";
import { SETTING_FIELDS, defaultSettings, saveSettings, settingsQuery, type SiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(settingsQuery());
  const [values, setValues] = useState<SiteSettings>(defaultSettings);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (values.contactEmail && !/^\S+@\S+\.\S+$/.test(values.contactEmail)) {
      toast.error("Enter a valid contact email address.");
      return;
    }
    setBusy(true);
    try {
      const changed = Object.fromEntries(
        Object.entries(values).filter(([key, value]) => (data?.[key as keyof SiteSettings] ?? "") !== value),
      ) as Partial<SiteSettings>;
      await saveSettings(changed);
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Settings saved.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not save the settings."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
          <Settings2 className="size-3.5" /> Site configuration
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Revivor Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          These values are stored in Supabase and read by the public website and checkout at runtime.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
        <Database className="size-4" /> Single source of truth: <code className="rounded bg-white px-1.5 py-0.5">public.site_settings</code>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="font-black">Brand, contact & website</h2>
            <p className="mt-1 text-xs text-slate-500">Controls identity and contact information shown to students.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {SETTING_FIELDS.filter((field) => ["brandName", "tagline", "contactEmail", "whatsappNumber", "websiteUrl"].includes(field.key)).map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input id={field.key} className="h-11 rounded-xl" value={values[field.key] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [field.key]: e.target.value }))} />
                  {field.help && <p className="text-xs text-slate-500">{field.help}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="font-black">Payment & delivery</h2>
            <p className="mt-1 text-xs text-slate-500">Checkout reads these values directly from the same database table.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {SETTING_FIELDS.filter((field) => ["upiId", "upiPayeeName", "qrCodeUrl", "deliveryEstimate"].includes(field.key)).map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input id={field.key} className="h-11 rounded-xl" value={values[field.key] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [field.key]: e.target.value }))} />
                  {field.help && <p className="text-xs text-slate-500">{field.help}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="font-black">Social links</h2>
            <p className="mt-1 text-xs text-slate-500">Footer and contact destinations.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {SETTING_FIELDS.filter((field) => ["instagram", "telegram", "youtube"].includes(field.key)).map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input id={field.key} className="h-11 rounded-xl" value={values[field.key] ?? ""} onChange={(e) => setValues((current) => ({ ...current, [field.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" className="h-11 rounded-xl bg-slate-950 px-6 font-black" disabled={busy}>
              <Save className="mr-2 size-4" /> {busy ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
