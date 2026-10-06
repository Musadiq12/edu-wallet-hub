import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const slides = [
  { eyebrow: "CS Executive", title: "Subject-wise preparation material for focused revision.", copy: "Keep notes, tests and revision resources organised around your CS preparation.", href: "/shop" },
  { eyebrow: "CSEET", title: "Build your preparation from the right basics.", copy: "Find concise digital resources without sorting through unrelated study material.", href: "/shop" },
];

export function StorefrontHero() {
  const [active, setActive] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 6000); return () => window.clearInterval(id); }, []);
  const slide = slides[active];
  return (
    <section className="page-container py-4 sm:py-6" aria-label="Featured CS preparation">
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">{slide.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{slide.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{slide.copy}</p>
            <Link to={slide.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Browse resources <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
          <div className="flex items-center gap-0.5" role="tablist" aria-label="Featured slides">
            {slides.map((item, index) => (
              <button key={item.eyebrow} type="button" role="tab" aria-selected={index === active} aria-label={`Show slide ${index + 1}`} onClick={() => setActive(index)} className="flex size-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={`h-2.5 rounded-full ${index === active ? "w-8 bg-primary" : "w-2.5 bg-muted-foreground/40"}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
