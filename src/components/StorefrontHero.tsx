import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
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
  alt?: string;
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

const DEFAULT_INTERVAL = 4500;

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

function resizedBannerUrl(source: string, width: number): string {
  try {
    const url = new URL(source);
    if (url.pathname.endsWith("/image") || url.searchParams.has("width")) {
      url.searchParams.set("width", String(width));
      if (url.searchParams.has("quality")) url.searchParams.set("quality", "90");
    }
    return url.toString();
  } catch {
    return source;
  }
}

function bannerSrcSet(source: string, widths: number[]): string | undefined {
  try {
    const url = new URL(source);
    if (!url.pathname.endsWith("/image") && !url.searchParams.has("width")) return undefined;
    return widths.map((width) => `${resizedBannerUrl(source, width)} ${width}w`).join(", ");
  } catch {
    return undefined;
  }
}

export function StorefrontHero() {
  const settings = useSiteSettings();
  const heroSlides = useMemo(() => parseSlides(settings.heroSlides), [settings.heroSlides]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const slide = heroSlides[active] ?? heroSlides[0];
  const interval = Math.min(30000, Math.max(2500, Number(settings.heroIntervalMs) || DEFAULT_INTERVAL));

  useEffect(() => {
    setActive((current) => Math.min(current, heroSlides.length - 1));
  }, [heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length < 2 || paused) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % heroSlides.length), interval);
    return () => window.clearInterval(timer);
  }, [heroSlides.length, interval, paused]);

  const goTo = (index: number) => setActive((index + heroSlides.length) % heroSlides.length);
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    touchStart.current = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || !touchStart.current) return;
    const dx = event.clientX - touchStart.current.x;
    const dy = event.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) goTo(active + (dx < 0 ? 1 : -1));
  };

  if (!slide) return null;

  return (
    <section
      className="w-full px-0 pt-3 sm:px-4 sm:pt-5 lg:px-6"
      aria-roledescription="carousel"
      aria-label="EduWallet featured resources"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      {(slide.imageUrl || slide.mobileImageUrl) && <h1 className="sr-only">Exam study notes, PDFs and solved papers for NEET, JEE, UPSC, SSC CGL, Banking and CLAT</h1>}
      <div
        className={cn("relative isolate mx-auto w-full max-w-[1920px] overflow-hidden border-y border-border/70 bg-gradient-to-br shadow-sm sm:rounded-2xl sm:border", slide.accent || "from-primary/10 via-background to-background")}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { touchStart.current = null; }}
      >
        {!(slide.imageUrl || slide.mobileImageUrl) ? (
          <div className="relative z-10 grid min-h-[340px] items-center gap-8 px-6 py-12 sm:px-10 lg:min-h-[390px] lg:grid-cols-[1.1fr_.9fr] lg:px-14">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden="true" />{slide.eyebrow}
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[3.6rem]">{slide.title}</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">{slide.description}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button size="lg" className="rounded-lg px-5 shadow-none" asChild><Link to={slide.to}>{slide.cta}<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>
                <Link to="/free-resources" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-foreground/80 transition-colors hover:bg-card/80 hover:text-primary">View free material</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground sm:text-sm">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-secondary" aria-hidden="true" /> Exam-focused resources</span>
                <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-secondary" aria-hidden="true" /> Notes and solved papers</span>
              </div>
            </div>
            <div className="relative mx-auto hidden h-[270px] w-full max-w-[370px] lg:block" aria-hidden="true">
              <div className="absolute left-7 top-3 h-[235px] w-[174px] -rotate-3 rounded-xl border border-border bg-card p-5 shadow-lg shadow-foreground/5">
                <div className="flex items-center gap-2 border-b border-border pb-4"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="h-4 w-4" /></div><div><div className="h-2 w-16 rounded bg-foreground/75" /><div className="mt-2 h-1.5 w-11 rounded bg-muted-foreground/30" /></div></div>
                <div className="mt-5 text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Study notes</div>
                <div className="mt-3 space-y-2.5"><div className="h-1.5 rounded bg-muted" /><div className="h-1.5 w-4/5 rounded bg-muted" /><div className="h-1.5 w-11/12 rounded bg-muted" /></div>
                <div className="mt-5 rounded-lg bg-muted/70 p-3"><div className="h-1.5 w-12 rounded bg-foreground/40" /><div className="mt-2 h-1.5 w-full rounded bg-foreground/10" /><div className="mt-1.5 h-1.5 w-3/4 rounded bg-foreground/10" /></div>
              </div>
              <div className="absolute right-1 top-8 w-[174px] rotate-3 rounded-xl border border-border bg-card p-4 shadow-xl shadow-foreground/10">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold">Resource library</span><BookOpen className="h-4 w-4 text-primary" /></div>
                <div className="mt-4 space-y-2.5"><div className="flex items-center gap-2 rounded-lg bg-muted/70 p-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">PDF</span><div><div className="h-1.5 w-20 rounded bg-foreground/60" /><div className="mt-1.5 h-1 w-12 rounded bg-muted-foreground/30" /></div></div><div className="flex items-center gap-2 rounded-lg bg-muted/70 p-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/15 text-[10px] font-bold text-secondary">EX</span><div><div className="h-1.5 w-16 rounded bg-foreground/60" /><div className="mt-1.5 h-1 w-10 rounded bg-muted-foreground/30" /></div></div></div>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] font-medium text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-secondary" /> Ready to study</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 w-full">
            <motion.div key={active} initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: "easeOut" }}>
            <picture>
              {slide.mobileImageUrl && <source media="(max-width: 639px)" srcSet={bannerSrcSet(slide.mobileImageUrl, [640, 900, 1080]) ?? slide.mobileImageUrl} />}
              <img
                src={resizedBannerUrl(slide.imageUrl || slide.mobileImageUrl || "", 1920)}
                srcSet={bannerSrcSet(slide.imageUrl || slide.mobileImageUrl || "", [960, 1280, 1600, 1920])}
                sizes="100vw"
                alt={slide.alt || `EduWallet study resources banner, slide ${active + 1}`}
                width="1920"
                height="800"
                className="block h-auto w-full max-w-full select-none object-contain"
                fetchPriority={active === 0 ? "high" : "auto"}
                loading={active === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
              />
            </picture>
            </motion.div>
            <Link
              to={slide.to}
              aria-label={slide.cta}
              className="group absolute bottom-[6%] left-[4.7%] z-20 hidden h-[12.6%] w-[22.9%] items-center justify-center gap-1 overflow-hidden rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-2 text-center text-[clamp(0.55rem,1.1vw,1.35rem)] font-semibold leading-none text-white shadow-lg shadow-violet-950/20 transition duration-200 hover:brightness-110 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-violet-700 active:scale-[0.98] sm:flex"
            >
              <span className="truncate">{slide.cta}</span><ArrowRight className="h-[1em] w-[1em] shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <div className="bg-background px-4 py-3 sm:hidden">
              <Link
                to={slide.to}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {slide.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
        {heroSlides.length > 1 && (
          <>
            <button type="button" onClick={() => goTo(active - 1)} aria-label="Previous banner" className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-5 sm:h-12 sm:w-12">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => goTo(active + 1)} aria-label="Next banner" className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-5 sm:h-12 sm:w-12">
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className="relative z-10 flex items-center justify-between border-t border-border/60 bg-card/90 px-4 py-2.5 sm:px-8">
              <span className="text-xs font-medium tabular-nums text-muted-foreground">{String(active + 1).padStart(2, "0")} <span className="mx-1 text-border">/</span> {String(heroSlides.length).padStart(2, "0")}</span>
              <div className="flex items-center gap-2" role="group" aria-label="Choose featured banner">
                {heroSlides.map((item, index) => (
                  <button key={item.title} type="button" aria-current={index === active ? "true" : undefined} aria-label={`Show banner ${index + 1}: ${item.title}`} onClick={() => goTo(index)} className={cn("h-2.5 rounded-full transition-all duration-300", index === active ? "w-8 bg-primary" : "w-2.5 bg-muted-foreground/35 hover:bg-muted-foreground/65")} />
                ))}
              </div>
              <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={paused} className="min-h-8 rounded-md px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{paused ? "Play slides" : "Pause slides"}</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
