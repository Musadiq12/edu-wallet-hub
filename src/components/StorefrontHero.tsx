import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/lib/settings";

type HeroSlide = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  to: "/shop" | "/free-resources";
  accent: string;
  secondary: string;
  imageUrl?: string;
  mobileImageUrl?: string;
};

const slides: HeroSlide[] = [
  {
    eyebrow: "Study resources, in one place",
    title: "Prepare with material that gets to the point.",
    description: "Browse clear notes, solved papers, revision guides and exam-focused resources—without searching across scattered websites.",
    cta: "Browse study resources",
    to: "/shop",
    accent: "from-primary/10 via-background to-background",
    secondary: "Curated study material",
  },
  {
    eyebrow: "Made for your next exam",
    title: "Your preparation. Better organised.",
    description: "Find resources for NEET, JEE, UPSC, SSC CGL, Banking and CLAT in a catalogue designed to make choosing simpler.",
    cta: "Explore the catalogue",
    to: "/shop",
    accent: "from-secondary/10 via-background to-background",
    secondary: "Browse by exam",
  },
  {
    eyebrow: "Start with free material",
    title: "Find your next useful study resource.",
    description: "Explore selected free resources, see what is available and choose material that matches your revision needs.",
    cta: "View free resources",
    to: "/free-resources",
    accent: "from-accent via-background to-background",
    secondary: "Free resources available",
  },
];

const DEFAULT_INTERVAL = 6500;

function parseSlides(value: string): HeroSlide[] {
  if (!value.trim()) return slides;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return slides;
    const valid = parsed.filter((item): item is HeroSlide =>
      item && typeof item.title === "string" && typeof item.description === "string" &&
      typeof item.eyebrow === "string" && typeof item.cta === "string" &&
      (item.to === "/shop" || item.to === "/free-resources")
    );
    return valid.length ? valid : slides;
  } catch {
    return slides;
  }
}

export function StorefrontHero() {
  const settings = useSiteSettings();
  const heroSlides = useMemo(() => parseSlides(settings.heroSlides), [settings.heroSlides]);
  const interval = Math.min(30000, Math.max(3500, Number(settings.heroIntervalMs) || DEFAULT_INTERVAL));
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = heroSlides[active] ?? heroSlides[0];

  useEffect(() => {
    setActive((current) => Math.min(current, heroSlides.length - 1));
  }, [heroSlides.length]);

  useEffect(() => {
    if (paused || heroSlides.length < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % heroSlides.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [paused, interval, heroSlides.length]);

  if (!slide) return null;

  return (
    <section
      className="page-container pt-5 sm:pt-8"
      aria-roledescription="carousel"
      aria-label="EduWallet featured resources"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      {slide.imageUrl && <h1 className="sr-only">Exam study notes, PDFs and solved papers for NEET, JEE, UPSC, SSC CGL, Banking and CLAT</h1>}
      <div className={cn("relative isolate overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br shadow-sm", slide.accent || "from-primary/10 via-background to-background")}>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] border-l border-border/50 bg-white/25 lg:block" aria-hidden="true" />
        {!slide.imageUrl ? (
          <div className="relative z-10 grid min-h-[340px] items-center gap-8 px-6 py-12 sm:px-10 lg:min-h-[390px] lg:grid-cols-[1.1fr_.9fr] lg:px-14">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden="true" />
                {slide.eyebrow}
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.6rem]">
                {slide.title}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                {slide.description}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button size="lg" className="rounded-lg px-5 shadow-none" asChild>
                  <Link to={slide.to}>
                    {slide.cta}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Link to="/free-resources" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-foreground/80 transition-colors hover:bg-card/80 hover:text-primary">
                  View free material
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground sm:text-sm">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-secondary" aria-hidden="true" /> Exam-focused resources</span>
                <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-secondary" aria-hidden="true" /> Notes and solved papers</span>
              </div>
            </div>

            <div className="relative mx-auto hidden h-[270px] w-full max-w-[370px] lg:block" aria-hidden="true">
              <div className="absolute left-7 top-3 h-[235px] w-[174px] -rotate-3 rounded-xl border border-border bg-card p-5 shadow-lg shadow-foreground/5">
                <div className="flex items-center gap-2 border-b border-border pb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="h-4 w-4" /></div>
                  <div><div className="h-2 w-16 rounded bg-foreground/75" /><div className="mt-2 h-1.5 w-11 rounded bg-muted-foreground/30" /></div>
                </div>
                <div className="mt-5 text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Study notes</div>
                <div className="mt-3 space-y-2.5"><div className="h-1.5 rounded bg-muted" /><div className="h-1.5 w-4/5 rounded bg-muted" /><div className="h-1.5 w-11/12 rounded bg-muted" /></div>
                <div className="mt-5 rounded-lg bg-muted/70 p-3"><div className="h-1.5 w-12 rounded bg-foreground/40" /><div className="mt-2 h-1.5 w-full rounded bg-foreground/10" /><div className="mt-1.5 h-1.5 w-3/4 rounded bg-foreground/10" /></div>
              </div>
              <div className="absolute right-1 top-8 w-[174px] rotate-3 rounded-xl border border-border bg-card p-4 shadow-xl shadow-foreground/10">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold">Resource library</span><BookOpen className="h-4 w-4 text-primary" /></div>
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/70 p-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">PDF</span><div><div className="h-1.5 w-20 rounded bg-foreground/60" /><div className="mt-1.5 h-1 w-12 rounded bg-muted-foreground/30" /></div></div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/70 p-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/15 text-[10px] font-bold text-secondary">EX</span><div><div className="h-1.5 w-16 rounded bg-foreground/60" /><div className="mt-1.5 h-1 w-10 rounded bg-muted-foreground/30" /></div></div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] font-medium text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-secondary" /> Ready to study</div>
              </div>
              <div className="absolute bottom-1 left-9 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-md shadow-foreground/5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10 text-secondary"><CheckCircle2 className="h-4 w-4" /></span>
                <div><p className="text-xs font-semibold text-foreground">Find it. Learn it.</p><p className="mt-1 text-[10px] text-muted-foreground">{slide.secondary}</p></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 w-full">
            {slide.mobileImageUrl ? (
              <>
                <img src={slide.imageUrl} alt={`EduWallet study resources banner, slide ${active + 1}`} className="hidden h-auto w-full max-w-full object-contain sm:block" fetchPriority={active === 0 ? "high" : "auto"} />
                <img src={slide.mobileImageUrl} alt={`Mobile banner for ${slide.title}`} className="block h-auto w-full max-w-full object-contain sm:hidden" fetchPriority={active === 0 ? "high" : "auto"} />
              </>
            ) : (
              <img src={slide.imageUrl} alt={`EduWallet banner slide ${active + 1}`} className="block h-auto w-full max-w-full object-contain" fetchPriority={active === 0 ? "high" : "auto"} />
            )}
          </div>
        )}
        {heroSlides.length > 1 && (
          <div className="relative z-10 flex items-center justify-between border-t border-border/60 bg-card/50 px-6 py-3 sm:px-10 lg:px-14">
            <span className="text-xs font-medium text-muted-foreground">{String(active + 1).padStart(2, "0")} <span className="mx-1 text-border">/</span> {String(heroSlides.length).padStart(2, "0")}</span>
            <div className="flex items-center gap-2" role="tablist" aria-label="Featured slides">
              {heroSlides.map((item, index) => (
                <button key={item.title} type="button" role="tab" aria-selected={index === active} aria-label={`Show slide ${index + 1}: ${item.title}`} onClick={() => setActive(index)} className={cn("h-1.5 rounded-full transition-all", index === active ? "w-7 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60")} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
