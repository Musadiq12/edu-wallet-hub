import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSiteSettings } from "@/lib/settings";

export default function AetherFlowHero() {
  const { brandName, tagline } = useSiteSettings();

  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-surface to-secondary/60" aria-label={`${brandName} introduction`}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(13,110,253,0.10),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(0,168,132,0.10),transparent_30%)]"
        aria-hidden="true"
      />
      <div className="page-container relative z-10 flex min-h-[500px] items-center py-20 md:min-h-[620px]">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur">
            <BookOpen className="size-4 text-primary" aria-hidden="true" />
            <span>Study Materials • Notes • Previous Papers • Updates</span>
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">{brandName}</h1>
          <p className="mt-4 text-xl font-medium text-primary sm:text-2xl">{tagline}</p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Study materials, notes, previous papers, important questions and educational updates for students from 8th class to university level, with a focus on Jammu & Kashmir and beyond.
          </p>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            Explore resources for Kashmir University, Cluster University, Jammu University, IGNOU and other student-focused academic needs.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/shop" label="Explore Study Materials" />
            <ButtonLink href="/free-resources" label="Free Resources" secondary />
          </div>
        </div>
      </div>
    </section>
  );
}

function ButtonLink({ href, label, secondary = false }: { href: string; label: string; secondary?: boolean }) {
  return (
    <Link
      to={href as "/"}
      className={secondary
        ? "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        : "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"}
    >
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}
