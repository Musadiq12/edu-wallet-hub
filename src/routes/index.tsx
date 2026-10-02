import { ArrowRight, BookOpen, BriefcaseBusiness, Building2, FileText, GraduationCap, Landmark, Scale, Sparkles } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StorefrontHero } from "@/components/StorefrontHero";
import { ProductCarousel } from "@/components/ProductCarousel";
import { EmptyState } from "@/components/EmptyState";
import { productsQuery, type Product } from "@/lib/catalog";
import { siteConfig } from "@/config/site";

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

const EXAMS = [
  { title: "NEET", icon: GraduationCap, query: "neet" },
  { title: "JEE", icon: BookOpen, query: "jee" },
  { title: "UPSC", icon: Landmark, query: "upsc" },
  { title: "SSC CGL", icon: BriefcaseBusiness, query: "ssc" },
  { title: "Banking", icon: Building2, query: "bank" },
  { title: "CLAT", icon: Scale, query: "clat" },
];

function includesTerm(product: Product, term: string) {
  const haystack = [
    product.title,
    product.description,
    product.course_label,
    product.subject_label,
    product.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(term.toLowerCase());
}

function filterProducts(products: Product[], term: string) {
  return products.filter((product) => includesTerm(product, term));
}

function Home() {
  const products = useQuery(productsQuery({ free: false, limit: 32 }));
  const freeProducts = useQuery(productsQuery({ free: true, limit: 12 }));
  const allProducts = products.data ?? [];

  const featured = allProducts.filter((product) => product.is_featured);
  const discounted = allProducts.filter(
    (product) =>
      product.discounted_price != null &&
      Number(product.discounted_price) < Number(product.price),
  );

  return (
    <>
      <StorefrontHero />

      <section className="py-7 sm:py-9">
        <div className="page-container">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Browse by exam</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Find your preparation track</h2>
            </div>
            <Link to="/shop" className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">
              View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {EXAMS.map(({ title, icon: Icon, query }) => (
              <Link
                key={title}
                to="/shop"
                search={{ q: query, category: undefined }}
                className="group rounded-xl border border-border bg-card p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Study resources</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {products.isLoading ? (
        <section className="section-y">
          <div className="page-container">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-7 flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-96 w-[72vw] shrink-0 animate-pulse rounded-xl bg-muted sm:w-[280px]" />
              ))}
            </div>
          </div>
        </section>
      ) : allProducts.length === 0 ? (
        <section className="section-y">
          <div className="page-container">
            <EmptyState
              title="Resources are being added"
              description="Check back shortly for notes, guess papers and exam guides."
              action={<Link to="/free-resources" className="text-sm font-semibold text-primary hover:underline">Explore free resources</Link>}
            />
          </div>
        </section>
      ) : (
        <>
          <ProductCarousel
            title="Featured resources"
            description="Hand-picked study material worth exploring."
            products={(featured.length ? featured : allProducts).slice(0, 10)}
          />

          <section className="border-y border-border bg-muted/35">
            <ProductCarousel
              title="New arrivals"
              description="Recently added resources, ready for your preparation."
              products={allProducts.slice(0, 12)}
            />
          </section>

          {discounted.length > 0 && (
            <ProductCarousel
              title="Special offers"
              description="Current resources available at a reduced price."
              products={discounted.slice(0, 12)}
            />
          )}

          {EXAMS.map(({ title, query }) => {
            const matches = filterProducts(allProducts, query).slice(0, 10);
            if (matches.length < 2) return null;
            return (
              <ProductCarousel
                key={title}
                title={`${title} preparation`}
                description={`Resources matched to ${title} preparation.`}
                products={matches}
              />
            );
          })}

          {freeProducts.data && freeProducts.data.length > 0 && (
            <section className="border-y border-border bg-accent/35">
              <ProductCarousel
                title="Free resources"
                description="Try useful study material before buying."
                products={freeProducts.data.slice(0, 10)}
              />
            </section>
          )}
        </>
      )}

      <section className="section-y">
        <div className="page-container">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                  <span className="text-sm font-semibold">Need something specific?</span>
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Browse the complete EduWallet catalog.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Filter by resource type, exam, course or keyword and go directly to the material you need.
                </p>
              </div>
              <Link
                to="/shop"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Browse catalog
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30 py-10">
        <div className="page-container grid gap-6 text-sm sm:grid-cols-3">
          <div className="flex gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="font-semibold">Digital-first</p><p className="mt-1 text-muted-foreground">Resources are delivered digitally after successful purchase verification.</p></div>
          </div>
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="font-semibold">Exam-focused</p><p className="mt-1 text-muted-foreground">Organized around practical study and revision needs.</p></div>
          </div>
          <div className="flex gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div><p className="font-semibold">Easy to browse</p><p className="mt-1 text-muted-foreground">Fast horizontal catalogs designed for desktop and mobile.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
