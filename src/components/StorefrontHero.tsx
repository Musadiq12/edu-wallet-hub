import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeroSlide = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  to: "/shop" | "/free-resources";
  accent: string;
  secondary: string;
};

const slides: HeroSlide[] = [
  {
    eyebrow: "Exam preparation, simplified",
    title: "Study smarter with the right resources.",
    description: "Find focused notes, solved papers, guess papers and exam guides without digging through scattered sources.",
    cta: "Explore resources",
    to: "/shop",
    accent: "from-primary/15 via-background to-secondary/10",
    secondary: "Trusted study format",
  },
  {
    eyebrow: "Built for competitive exams",
    title: "One place for NEET, JEE, UPSC, SSC, Banking and CLAT.",
    description: "Browse resources by exam and resource type, then get straight to the material you need.",
    cta: "Browse the shop",
    to: "/shop",
    accent: "from-secondary/20 via-background to-primary/10",
    secondary: "Exam-focused collections",
  },
  {
    eyebrow: "Start without spending",
    title: "Explore free resources before you buy.",
    description: "Preview the kind of material available on EduWallet and decide what fits your preparation.",
    cta: "View free resources",
    to: "/free-resources",
    accent: "from-accent via-background to-primary/10",
    secondary: "Free study material",
  },
];

const INTERVAL = 5500;

export function StorefrontHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = slides[active];

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, INTERVAL);
    return () => window.clearInterval(timer);
  }, [paused]);

  const previous = () => setActive((current) => (current - 1 + slides.length) % slides.length);
  const next = () => setActive((current) => (current + 1) % slides.length);

  return (
    <section
      className="page-container pt-4 sm:pt-6"
      aria-roledescription="carousel"
      aria-label="EduWallet promotions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br", slide.accent)}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid min-h-[390px] items-center gap-8 px-6 py-10 sm:px-10 lg:min-h-[440px] lg:grid-cols-[1.15fr_.85fr] lg:px-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/75 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {slide.eyebrow}
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {slide.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              {slide.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to={slide.to}>
                  {slide.cta}
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <div className="hidden items-center gap-2 rounded-lg border border-border bg-card/70 px-4 text-sm font-medium text-muted-foreground sm:flex">
                <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                {slide.secondary}
              </div>
            </div>
          </div>

          <div className="relative mx-auto hidden h-64 w-full max-w-md lg:block" aria-hidden="true">
            <div className="absolute left-8 top-10 h-48 w-32 -rotate-6 rounded-xl border border-border bg-card shadow-xl" />
            <div className="absolute left-28 top-2 h-56 w-36 rotate-3 rounded-xl border border-border bg-card shadow-xl" />
            <div className="absolute right-6 top-12 h-44 w-32 rotate-[-4deg] rounded-xl border border-border bg-card p-5 shadow-xl">
              <div className="h-3 w-14 rounded-full bg-primary/80" />
              <div className="mt-5 space-y-3">
                <div className="h-2 w-full rounded-full bg-muted" />
                <div className="h-2 w-4/5 rounded-full bg-muted" />
                <div className="h-2 w-3/5 rounded-full bg-muted" />
              </div>
              <div className="mt-8 h-10 rounded-lg bg-accent" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between sm:left-10 sm:right-10">
          <div className="flex gap-1.5" role="tablist" aria-label="Hero slides">
            {slides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Show slide ${index + 1}`}
                onClick={() => setActive(index)}
                className={cn("h-1.5 rounded-full transition-all", index === active ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30")}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={previous} aria-label="Previous promotion" className="rounded-full border border-border bg-card/80 p-2 shadow-sm backdrop-blur transition-colors hover:bg-card">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={next} aria-label="Next promotion" className="rounded-full border border-border bg-card/80 p-2 shadow-sm backdrop-blur transition-colors hover:bg-card">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
