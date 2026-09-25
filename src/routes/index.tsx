import { useSiteSettings } from "@/lib/settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeIndianRupee,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Gift,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, LoadingGrid } from "@/components/EmptyState";
import { productsQuery } from "@/lib/catalog";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${siteConfig.fallbackBrand.brandName} — ${siteConfig.fallbackBrand.tagline}` },
      { name: "description", content: siteConfig.shortDescription },
      { property: "og:title", content: `${siteConfig.fallbackBrand.brandName} — ${siteConfig.fallbackBrand.tagline}` },
      { property: "og:description", content: siteConfig.shortDescription },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

const VALUES = [
  {
    icon: Target,
    title: "Exam Focused",
    text: "Resources organized around practical exam preparation.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Affordable",
    text: "Low-cost digital resources designed for students.",
  },
  {
    icon: ClipboardCheck,
    title: "Clear Access Process",
    text: "Purchase confirmation and delivery handled through email or WhatsApp.",
  },
  {
    icon: Users,
    title: "Student Friendly",
    text: "Simple, straightforward resources without unnecessary complexity.",
  },
];

const CATEGORIES = [
  {
    icon: BookOpen,
    title: "Notes",
    text: "Subject-wise notes and revision material.",
    to: "/shop" as const,
    search: { category: "notes", q: undefined },
  },
  {
    icon: FileText,
    title: "Guess Papers",
    text: "Exam-oriented practice and likely-topic guides.",
    to: "/shop" as const,
    search: { category: "guess-papers", q: undefined },
  },
  {
    icon: ClipboardCheck,
    title: "Assignment Guidance",
    text: "Original reference material and explanations designed to help students understand and complete assignments.",
    to: "/shop" as const,
    search: { category: "assignment-guidance", q: undefined },
  },
  {
    icon: GraduationCap,
    title: "Exam Guides",
    text: "Focused preparation and revision resources.",
    to: "/shop" as const,
    search: { category: "exam-guides", q: undefined },
  },
];

function Home() {
  const settings = useSiteSettings();
  const featured = useQuery(productsQuery({ featured: true, free: false, limit: 8 }));

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="page-container grid gap-10 py-14 md:grid-cols-[1.15fr_1fr] md:items-center md:py-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
              For IGNOU students
            </p>
            <h1 className="mt-3 text-4xl leading-tight font-bold text-foreground sm:text-5xl">
              {settings.tagline}
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              {siteConfig.shortDescription}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/shop">Explore Resources</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/free-resources">Free Resources</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">{siteConfig.disclaimer}</p>
          </div>

          <div aria-hidden="true" className="relative hidden md:block">
            <div className="absolute top-6 left-6 h-56 w-44 rotate-[-6deg] rounded-md border border-border bg-card shadow-sm" />
            <div className="absolute top-3 left-24 h-60 w-44 rotate-[4deg] rounded-md border border-border bg-card shadow-sm" />
            <div className="relative ml-12 h-64 w-48 rounded-md border border-border bg-card p-4 shadow-sm">
              <div className="h-2 w-16 rounded bg-primary/80" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded bg-muted"
                    style={{ width: `${95 - i * 7}%` }}
                  />
                ))}
              </div>
              <div className="mt-6 h-1.5 w-20 rounded bg-accent/70" />
            </div>
          </div>
        </div>
      </section>

      <section className="section-y">
        <div className="page-container">
          <h2 className="text-2xl font-semibold sm:text-3xl">Why students use Edu Wallet</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-lg border border-border bg-card p-5">
                <v.icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold">{v.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-y bg-surface">
        <div className="page-container">
          <h2 className="text-2xl font-semibold sm:text-3xl">Explore Edu Wallet</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <Link
                key={c.title}
                to={c.to}
                search={c.search}
                className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <c.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{c.text}</p>
              </Link>
            ))}
            <Link
              to="/free-resources"
              className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <Gift className="h-5 w-5 text-success" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold">Free Resources</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Free samples and study material.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <section className="section-y">
        <div className="page-container">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold sm:text-3xl">Featured resources</h2>
            <Link to="/shop" className="text-sm font-medium text-primary hover:underline">
              View all resources
            </Link>
          </div>

          <div className="mt-8">
            {featured.isLoading ? (
              <LoadingGrid />
            ) : featured.data && featured.data.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featured.data.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Resources are being added soon"
                description="Check back shortly for notes, guess papers and exam guides."
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
