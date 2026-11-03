import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BUCKETS, LIMITS, friendlyError, uploadFile } from "@/lib/admin";
import { publicImageUrl } from "@/lib/image-storage";
import { AdminFileField, type PickedFile } from "@/components/admin/AdminFileField";
import { SETTING_FIELDS, defaultSettings, saveSettings, settingsQuery, type SiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

type EditableHeroSlide = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  to: string;
  secondary: string;
  imageUrl: string;
  mobileImageUrl?: string;
  alt?: string;
};

function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(settingsQuery());
  const [values, setValues] = useState<SiteSettings>(defaultSettings);
  const [busy, setBusy] = useState(false);
  const [heroInterval, setHeroInterval] = useState("4500");
  const [pickedHeroImages, setPickedHeroImages] = useState<(PickedFile | null)[]>([null, null, null]);
  const [pickedMobileHeroImages, setPickedMobileHeroImages] = useState<(PickedFile | null)[]>([null, null, null]);
  const [heroSlides, setHeroSlides] = useState<EditableHeroSlide[]>([
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
        const slide = updatedSlides[index];
        if (!slide) continue;
        const desktopPicked = pickedHeroImages[index];
        const mobilePicked = pickedMobileHeroImages[index];
        if (desktopPicked) {
          const { path } = await uploadFile(BUCKETS.cover, desktopPicked.file, "hero-banners");
          updatedSlides[index] = { ...slide, imageUrl: publicImageUrl(BUCKETS.cover, path, 1920) ?? "" };
        }
        if (mobilePicked) {
          const { path } = await uploadFile(BUCKETS.cover, mobilePicked.file, "hero-banners-mobile");
          updatedSlides[index] = { ...(updatedSlides[index] ?? slide), mobileImageUrl: publicImageUrl(BUCKETS.cover, path, 1080) ?? "" };
        }
      }
      await saveSettings({
        ...changed,
        heroSlides: JSON.stringify(updatedSlides),
        heroIntervalMs: String(Math.min(30000, Math.max(2500, Number(heroInterval) || 4500))),
      });
      setHeroSlides(updatedSlides);
      setPickedHeroImages([null, null, null]);
      setPickedMobileHeroImages([null, null, null]);
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`hero-eyebrow-${index}`}>Eyebrow</Label>
                    <Input id={`hero-eyebrow-${index}`} value={slide.eyebrow ?? ""} onChange={(event) => setHeroSlides((current) => current.map((item, i) => i === index ? { ...item, eyebrow: event.target.value } : item))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`hero-title-${index}`}>Title</Label>
                    <Input id={`hero-title-${index}`} value={slide.title ?? ""} onChange={(event) => setHeroSlides((current) => current.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`hero-description-${index}`}>Subtitle / description</Label>
                    <Input id={`hero-description-${index}`} value={slide.description ?? ""} onChange={(event) => setHeroSlides((current) => current.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`hero-cta-${index}`}>Button text</Label>
                    <Input id={`hero-cta-${index}`} value={slide.cta ?? ""} onChange={(event) => setHeroSlides((current) => current.map((item, i) => i === index ? { ...item, cta: event.target.value } : item))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`hero-link-${index}`}>Button link</Label>
                    <select id={`hero-link-${index}`} value={slide.to ?? "/shop"} onChange={(event) => setHeroSlides((current) => current.map((item, i) => i === index ? { ...item, to: event.target.value } : item))} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="/shop">Shop</option>
                      <option value="/free-resources">Free resources</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`hero-alt-${index}`}>Image alt text</Label>
                    <Input id={`hero-alt-${index}`} value={slide.alt ?? ""} placeholder="Describe the banner for screen readers" onChange={(event) => setHeroSlides((current) => current.map((item, i) => i === index ? { ...item, alt: event.target.value } : item))} />
                  </div>
                </div>
                <AdminFileField
                  id={`hero-image-${index}`}
                  label="Desktop banner image"
                  help="Desktop image. Recommended 1920 × 800 px (or wider 21:9), PNG/WebP/JPG, maximum 5 MB. Upload at full resolution; avoid screenshots."
                  accept="image/*"
                  maxBytes={LIMITS.coverBytes}
                  kind="image"
                  existingPath={pickedHeroImages[index] ? null : (slide.imageUrl || null)}
                  picked={pickedHeroImages[index] ?? null}
                  onPick={(picked) => setPickedHeroImages((current) => current.map((item, i) => i === index ? picked : item))}
                />
                <AdminFileField
                  id={`hero-mobile-image-${index}`}
                  label="Mobile banner image (recommended)"
                  help="Mobile image. Recommended 1080 × 1350 px (4:5). Upload a separate composition for phones; maximum 5 MB. If omitted, the desktop image is used."
                  accept="image/*"
                  maxBytes={LIMITS.coverBytes}
                  kind="image"
                  existingPath={pickedMobileHeroImages[index] ? null : (slide.mobileImageUrl || null)}
                  picked={pickedMobileHeroImages[index] ?? null}
                  onPick={(picked) => setPickedMobileHeroImages((current) => current.map((item, i) => i === index ? picked : item))}
                />
              </section>
            ))}
          </div>
          <Button type="submit" className="h-11" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
        </form>
      )}
    </div>
  );
}
