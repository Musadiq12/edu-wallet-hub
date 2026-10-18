import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BUCKETS, LIMITS, friendlyError, uploadFile } from "@/lib/admin";
import { AdminFileField, type PickedFile } from "@/components/admin/AdminFileField";
import { supabase } from "@/integrations/supabase/client";
import { SETTING_FIELDS, defaultSettings, saveSettings, settingsQuery, type SiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(settingsQuery());
  const [values, setValues] = useState<SiteSettings>(defaultSettings);
  const [busy, setBusy] = useState(false);
  const [heroInterval, setHeroInterval] = useState("4500");
  const [pickedHeroImages, setPickedHeroImages] = useState<(PickedFile | null)[]>([null, null, null]);
  const [heroSlides, setHeroSlides] = useState([
    { eyebrow: "Exam preparation, simplified", title: "Study smarter with the right resources.", description: "Find focused notes, solved papers, guess papers and exam guides without digging through scattered sources.", cta: "Explore resources", to: "/shop", secondary: "Trusted study format", imageUrl: "" },
    { eyebrow: "Built for competitive exams", title: "One place for NEET, JEE, UPSC, SSC, Banking and CLAT.", description: "Browse resources by exam and resource type, then get straight to the material you need.", cta: "Browse the shop", to: "/shop", secondary: "Exam-focused collections", imageUrl: "" },
    { eyebrow: "Start without spending", title: "Explore free resources before you buy.", description: "Preview the kind of material available on EduWallet and decide what fits your preparation.", cta: "View free resources", to: "/free-resources", secondary: "Free study material", imageUrl: "" },
  ]);

  useEffect(() => {
    if (data) {
      setValues(data);
      setHeroInterval(data.heroIntervalMs || "4500");
      if (data.heroSlides) {
        try {
          const parsed = JSON.parse(data.heroSlides);
          if (Array.isArray(parsed) && parsed.length) setHeroSlides(parsed);
        } catch {
          // Keep the editable defaults if stored JSON is invalid.
        }
      }
    }
  }, [data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.contactEmail && !/^\S+@\S+\.\S+$/.test(values.contactEmail)) {
      return void toast.error("Enter a valid contact email address.");
    }
    setBusy(true);
    try {
      // Save only the fields that changed so other settings are never overwritten.
      const changed = Object.fromEntries(
        Object.entries(values).filter(([k, v]) => (data?.[k as keyof SiteSettings] ?? "") !== v),
      ) as Partial<SiteSettings>;
      const updatedSlides = [...heroSlides];
      for (let index = 0; index < pickedHeroImages.length; index++) {
        const picked = pickedHeroImages[index];
        if (!picked) continue;
        const { path } = await uploadFile(BUCKETS.cover, picked.file, "hero-banners");
        const { data: publicData } = supabase.storage.from(BUCKETS.cover).getPublicUrl(path);
        updatedSlides[index] = { ...updatedSlides[index], imageUrl: publicData.publicUrl };
      }
      await saveSettings({
        ...changed,
        heroSlides: JSON.stringify(updatedSlides),
        heroIntervalMs: String(Math.min(30000, Math.max(2500, Number(heroInterval) || 4500))),
      });
      setHeroSlides(updatedSlides);
      setPickedHeroImages([null, null, null]);
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not save the settings."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage website details and the homepage hero banner. Saved changes are used by the public website.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
      ) : (
        <form onSubmit={submit} className="max-w-2xl space-y-4">
          {SETTING_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                className="h-11"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            </div>
          ))}
          <div className="space-y-4 border-t border-border pt-6">
            <div>
              <h2 className="text-lg font-semibold">Homepage hero banner</h2>
              <p className="mt-1 text-sm text-muted-foreground">Edit all three slides and set how quickly they rotate. The public homepage updates from these saved settings.</p>
            </div>
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="heroInterval">Slide interval (seconds)</Label>
              <Input id="heroInterval" type="number" min="2.5" max="30" step="0.5" value={String(Number(heroInterval) / 1000)} onChange={(e) => setHeroInterval(String(Number(e.target.value) * 1000))} />
              <p className="text-xs text-muted-foreground">Default: 4.5 seconds. Allowed range: 2.5–30 seconds.</p>
            </div>
            {heroSlides.slice(0, 3).map((slide, index) => (
              <section key={index} className="space-y-3 rounded-xl border border-border p-4">
                <h3 className="font-semibold">Slide {index + 1}</h3>
                <AdminFileField
                  id={`hero-image-${index}`}
                  label={`Upload full-slide image ${index + 1}`}
                  help="Upload one complete banner image. It will be shown as-is without separate heading or description overlays. Recommended: wide 16:5 image, JPG, PNG or WebP, max 5 MB."
                  accept="image/*"
                  maxBytes={LIMITS.coverBytes}
                  kind="image"
                  existingPath={pickedHeroImages[index] ? null : (slide.imageUrl || null)}
                  picked={pickedHeroImages[index]}
                  onPick={(picked) => setPickedHeroImages((current) => current.map((item, i) => i === index ? picked : item))}
                />
              </section>
            ))}}
                <div className="space-y-1.5">
                  <Label htmlFor={`hero-${index}-to`}>Button destination</Label>
                  <select id={`hero-${index}-to`} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={slide.to} onChange={(e) => setHeroSlides((current) => current.map((item, i) => i === index ? { ...item, to: e.target.value as "/shop" | "/free-resources" } : item))}>
                    <option value="/shop">Shop / resources</option>
                    <option value="/free-resources">Free resources</option>
                  </select>
                </div>
              </section>
            ))}
          </div>
          <Button type="submit" className="h-11" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
        </form>
      )}
    </div>
  );
}
