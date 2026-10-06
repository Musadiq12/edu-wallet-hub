import { BookOpen, CalendarDays, CheckCircle2, FileCheck2, Filter, GraduationCap } from "lucide-react";
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/EmptyState";
import { ProductCard } from "@/components/ProductCard";
import { categoriesQuery, productsQuery } from "@/lib/catalog";
import { siteConfig } from "@/config/site";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { useSiteSettings, safeUrl } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exam Study Resources" },
      { name: "description", content: siteConfig.shortDescription },
      { property: "og:title", content: "Exam Study Resources" },
      { property: "og:description", content: siteConfig.shortDescription },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function Home() {
  const products = useQuery(productsQuery({ free: false, limit: 24 }));
  const { homeHeroImage } = useSiteSettings();
  const categories = useQuery(categoriesQuery());
  const [course, setCourse] = useState("");
  const [category, setCategory] = useState("");
  const courseOptions = Array.from(new Set((products.data ?? []).map((p) => p.course_label).filter(Boolean))) as string[];
  const categoryOptions = categories.data ?? [];
  const matches = (products.data ?? []).filter((p) => (!course || p.course_label === course) && (!category || p.category_id === category));
  const featured = matches.find((p) => p.is_featured) ?? matches[0];
  const quickLinks = [
    { label: "Schedule & Syllabus", icon: CalendarDays, href: "/shop" },
    { label: "Test Series Details", icon: BookOpen, href: "/shop" },
    { label: "Procedure to Buy", icon: CheckCircle2, href: "/shop" },
    { label: "Checked Sheets", icon: FileCheck2, href: "/shop" },
  ];
  return (
    <div>
      <section className="border-b border-border bg-card/90 backdrop-blur-sm"><div className="page-container py-4 sm:py-5"><nav aria-label="Quick links" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{quickLinks.map(({ label, icon: Icon, href }) => <Link key={label} to={href as "/"} className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-center text-sm font-semibold transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"><Icon className="size-4 shrink-0" aria-hidden="true" />{label}</Link>)}</nav></div></section>
      <section className="page-container py-10 sm:py-14"><div className="grid items-center gap-8 rounded-xl border border-border bg-card/90 p-5 shadow-sm backdrop-blur-sm sm:p-8 lg:grid-cols-[1fr_330px] lg:p-10">
        <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">CSEET · CS Executive · CS Professional</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Popular Courses</h1><p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">Choose your CS level, select the resource you need, and go straight to focused preparation material.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course</span><select value={course} onChange={(e) => setCourse(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">All courses</option>{courseOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="grid gap-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Products</span><select className="h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" defaultValue=""><option value="">All products</option>{matches.slice(0, 12).map((p) => <option key={p.id}>{p.title}</option>)}</select></label>
            <label className="grid gap-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</span><select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">All categories</option>{categoryOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <label className="grid gap-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Levels</span><select className="h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" defaultValue=""><option value="">All levels</option><option>CSEET</option><option>CS Executive</option><option>CS Professional</option></select></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><Link to="/shop" search={{ q: course || undefined, category: undefined }} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Filter className="size-4" aria-hidden="true" />Get</Link><span className="text-sm text-muted-foreground">{products.isLoading ? "Loading courses…" : products.isError ? "Catalog unavailable" : matches.length + " matching resources"}</span></div>
        </div>
        <div className="min-w-0">
          {products.isLoading ? <div className="aspect-[3/4] rounded-lg border border-border bg-muted" aria-hidden="true" /> : products.isError ? <EmptyState title="Catalog unavailable" description="The course catalog could not be loaded. Try again from the shop." /> : featured ? (
            homeHeroImage ? (
              <Link to="/shop/$slug" params={{ slug: featured.slug }} className="block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg" aria-label={`View details for ${featured.title}`}>
                <HomeFeatureImage value={homeHeroImage} title={featured.title} />
              </Link>
            ) : <ProductCard product={featured} />
          ) : <EmptyState title="No course matches" description="Clear the filters or browse the full catalog." />}
        </div>
      </div></section>
      <section className="border-y border-border bg-muted/20 backdrop-blur-sm"><div className="page-container grid gap-0 sm:grid-cols-3">{[{ icon: GraduationCap, title: "CS-focused", copy: "Built around CSEET, Executive and Professional preparation." },{ icon: BookOpen, title: "Practical material", copy: "Notes, tests and revision resources organised by use." },{ icon: FileCheck2, title: "Easy access", copy: "Digital resources delivered after purchase verification." }].map(({ icon: Icon, title, copy }) => <div key={title} className="flex items-center gap-3 border-b border-border py-5 last:border-b-0 sm:border-b-0 sm:px-5"><span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary"><Icon className="size-4" aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p></div></div>)}</div></section>
    </div>
  );
}

function HomeFeatureImage({ value, title }: { value: string; title: string }) {
  const url = safeUrl(value) || (value && !value.startsWith("http") ? supabase.storage.from("product-covers").getPublicUrl(value).data.publicUrl : "");
  if (!url) return <div className="flex aspect-[3/4] items-center justify-center bg-surface text-sm text-muted-foreground">Upload a homepage image in Admin → Settings.</div>;
  return <img src={url} alt={title} loading="eager" decoding="async" className="block aspect-[3/4] h-full w-full object-cover" />;
}
