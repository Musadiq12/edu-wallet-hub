import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Landmark,
  LockKeyhole,
  Mail,
  Menu,
  Newspaper,
  PenLine,
  PlayCircle,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/ProductCard";
import { LoadingGrid } from "@/components/EmptyState";
import { productsQuery } from "@/lib/catalog";
import { siteConfig } from "@/config/site";
import { useSiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduWallet — Study Smart. Score Better." },
      { name: "description", content: "Exam-focused digital study resources for NEET, JEE, UPSC, SSC CGL, banking, CLAT and boards." },
      { property: "og:title", content: "EduWallet — Study Smart. Score Better." },
      { property: "og:description", content: "Exam-focused digital study resources organised by exam." },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type Exam = {
  name: string;
  slug: string;
  icon: Icon;
  line: string;
  count: number | null;
};

type ResourceType = {
  name: string;
  slug: string;
  icon: Icon;
  line: string;
  free?: boolean;
};

type ProofItem = {
  quote: string;
  name: string;
  exam: string;
};

type Stats = {
  studentsHelped?: string;
  resources?: string;
  examsCovered?: string;
};

const EXAMS: Exam[] = [
  { name: "NEET", slug: "neet", icon: Target, line: "Medical entrance prep", count: null },
  { name: "JEE", slug: "jee", icon: GraduationCap, line: "Engineering entrance prep", count: null },
  { name: "UPSC", slug: "upsc", icon: Landmark, line: "Civil services prep", count: null },
  { name: "SSC CGL", slug: "ssc-cgl", icon: BriefcaseBusiness, line: "Government exam prep", count: null },
  { name: "Banking", slug: "banking", icon: LockKeyhole, line: "Banking exam prep", count: null },
  { name: "CLAT", slug: "clat", icon: ScrollText, line: "Law entrance prep", count: null },
  { name: "Boards", slug: "boards", icon: BookOpen, line: "Board exam revision", count: null },
];

const RESOURCE_TYPES: ResourceType[] = [
  { name: "Notes", slug: "notes", icon: BookOpen, line: "Concise study notes for focused revision." },
  { name: "Guess Papers", slug: "guess-papers", icon: FileText, line: "Practice around likely exam topics." },
  { name: "Solved Papers", slug: "solved-papers", icon: Check, line: "Work through previous questions with answers." },
  { name: "Assignment Guidance", slug: "assignment-guidance", icon: PenLine, line: "Reference material to understand your work." },
  { name: "Exam Guides", slug: "exam-guides", icon: Award, line: "Targeted guides for smarter revision." },
  { name: "Free Resources", slug: "free-resources", icon: Sparkles, line: "Start with useful samples before you buy.", free: true },
];

const TRUST_ITEMS = [
  [ShieldCheck, "Instant digital delivery"],
  [LockKeyhole, "Secure payment"],
  [GiftIcon, "Free samples available"],
  [Users, "Support within 24 hours"],
] as const;

function GiftIcon({ className, "aria-hidden": ariaHidden }: { className?: string; "aria-hidden"?: boolean }) {
  return <Sparkles className={className} aria-hidden={ariaHidden} />;
}

const FAQS = [
  ["Which payment methods are supported?", "Payment options shown at checkout are the active options for your store. Follow the checkout instructions and keep the transaction reference for confirmation."],
  ["How does delivery work?", "After payment verification, your resource can be added to My Library and may also be confirmed through email or WhatsApp using the contact details you provide."],
  ["What is the refund policy?", "Digital products are generally not refundable after access or delivery. If payment succeeds but access is incorrect or missing, contact support with your order details for review."],
  ["Are the resources PDF files?", "Most marketplace resources are delivered digitally in PDF format. The exact format and page count are shown on the relevant product page."],
  ["How do I contact support?", "Use the Contact page or the support contact listed in the footer. Include your order details when you need help with payment or delivery."],
];

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function ExamChips() {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-1" aria-label="Browse by exam">
      {EXAMS.map((exam) => (
        <Link
          key={exam.slug}
          to="/shop"
          search={{ exam: exam.slug, q: undefined, category: undefined }}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {exam.name}
        </Link>
      ))}
    </div>
  );
}

export function Hero() {
  const settings = useSiteSettings();
  const [search, setSearch] = useState("");
  const reduceMotion = useReducedMotion();
  const eyebrow = settings.tagline === siteConfig.fallbackBrand.tagline ? "Trusted by students across India" : settings.tagline;

  return (
    <section className="border-b border-border bg-background">
      <div className="page-container grid gap-10 py-12 md:grid-cols-[1.03fr_.97fr] md:items-center md:py-20 lg:py-24">
        <Reveal>
          <div className="max-w-2xl">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              {eyebrow}
            </Badge>
            <h1 className="mt-5 max-w-xl font-serif text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Study Smart. Score Better.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Exam-focused notes, guess papers and solved papers, organised by exam so you find what you need in seconds.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/shop">Browse Resources <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/free-resources">Get Free Samples</Link>
              </Button>
            </div>
            <div className="mt-7">
              <ExamChips />
            </div>
            <form
              className="mt-6 flex max-w-xl gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                window.location.href = search.trim() ? `/shop?q=${encodeURIComponent(search.trim())}` : "/shop";
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes, exams, or topics" aria-label="Search resources" className="h-11 pl-9" />
              </div>
              <Button type="submit" variant="secondary" className="h-11 px-5">Search</Button>
            </form>
          </div>
        </Reveal>

        <Reveal className="min-h-[350px]">
          <div className="relative mx-auto w-full max-w-md" aria-label="Study resource preview">
            <motion.div
              initial={reduceMotion ? false : { y: 0, rotate: -4 }}
              animate={reduceMotion ? undefined : { y: [-5, 5, -5], rotate: [-4, -2.5, -4] }}
              transition={reduceMotion ? undefined : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-0 top-10 w-[74%] rounded-xl border border-border bg-card p-5 shadow-lg"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-primary"><FileText className="h-4 w-4" aria-hidden="true" /> PDF NOTES</div>
              <div className="mt-5 space-y-3">
                {[85, 72, 92, 60, 78].map((width) => <div key={width} className="h-2 rounded bg-muted" style={{ width: `${width}%` }} />)}
              </div>
              <div className="mt-6 h-24 rounded-lg bg-primary/5" />
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { y: 0, rotate: 4 }}
              animate={reduceMotion ? undefined : { y: [6, -4, 6], rotate: [4, 2.5, 4] }}
              transition={reduceMotion ? undefined : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative ml-auto w-[72%] rounded-xl border border-border bg-card p-5 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">2026</Badge>
                <Newspaper className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <h2 className="mt-5 font-serif text-2xl font-semibold">Guess Paper</h2>
              <p className="mt-2 text-sm text-muted-foreground">Focused practice for your next revision session.</p>
              <div className="mt-5 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-success" aria-hidden="true" /> Solved questions</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-success" aria-hidden="true" /> Exam-focused topics</div>
              </div>
            </motion.div>
            <div className="absolute -bottom-4 left-8 flex w-52 items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Check className="h-5 w-5" aria-hidden="true" /></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solved Paper</p><p className="text-sm font-semibold">Ready to revise</p></div>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="border-t border-border bg-card">
        <div className="page-container grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {TRUST_ITEMS.map(([Icon, label]) => (
            <div key={label} className="flex min-h-[74px] items-center gap-3 px-3 py-4 first:pl-0 sm:px-5">
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-xs font-medium leading-5 text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ExamGrid() {
  return (
    <section className="section-y">
      <div className="page-container">
        <SectionHeading eyebrow="Choose your path" title="Shop by exam" description="Jump straight to resources for the exam you are preparing for." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMS.map((exam) => (
            <Link key={exam.slug} to="/shop" search={{ exam: exam.slug, q: undefined, category: undefined }} className="interactive-lift group rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 text-primary"><exam.icon className="h-5 w-5" aria-hidden="true" /></div>
                {exam.count !== null && <span className="text-xs text-muted-foreground">{exam.count} resources</span>}
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold">{exam.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{exam.line}</p>
              <span className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">Browse <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ResourceTypeGrid() {
  return (
    <section className="section-y bg-card border-y border-border">
      <div className="page-container">
        <SectionHeading eyebrow="Browse by format" title="Find the right resource type" description="Use the format that matches your next study task." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_TYPES.map((type) => (
            <Link
              key={type.name}
              to={type.free ? "/free-resources" : "/shop"}
              search={type.free ? undefined : { category: type.slug, q: undefined }}
              className={`interactive-lift rounded-xl border p-5 ${type.free ? "border-amber-300 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/20" : "border-border bg-background"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 text-primary"><type.icon className="h-5 w-5" aria-hidden="true" /></div>
                {type.free && <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">Free</Badge>}
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold">{type.name}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{type.line}</p>
              <span className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">Explore <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedResources() {
  const featured = useQuery(productsQuery({ featured: true, free: false, limit: 8 }));
  return (
    <section className="section-y">
      <div className="page-container">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Curated picks" title="Featured resources" description="Useful, exam-focused material ready when you are." />
          <Button variant="outline" asChild><Link to="/shop">View all <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button>
        </div>
        <div className="mt-8">
          {featured.isLoading ? <LoadingGrid count={4} /> : featured.isError ? <EmptyFeaturedState /> : featured.data?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{featured.data.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          ) : <EmptyFeaturedState />}
        </div>
      </div>
    </section>
  );
}

export function EmptyState() {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary"><Mail className="h-6 w-6" aria-hidden="true" /></div>
      <h3 className="mt-5 font-serif text-2xl font-semibold">New resources are on the way</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Get notified when new exam resources arrive, or start with the free library.</p>
      <form onSubmit={(event) => { event.preventDefault(); setSaved(Boolean(email.trim())); }} className="mx-auto mt-6 flex max-w-lg flex-col gap-2 sm:flex-row">
        <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" aria-label="Email for resource updates" className="min-h-11" />
        <Button type="submit" className="min-h-11">{saved ? "You're on the list" : "Get notified"}</Button>
      </form>
      <div className="mt-4"><Link to="/free-resources" className="inline-flex min-h-11 items-center justify-center gap-1 px-3 text-sm font-semibold text-primary hover:underline">Browse Free Resources <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
    </div>
  );
}

function EmptyFeaturedState() {
  return <EmptyState />;
}

export function HowItWorks() {
  const steps = [
    [1, "Choose your resource", "Pick an exam-focused PDF from the shop.", BookOpen],
    [2, "Pay securely", "Complete checkout and keep your transaction reference.", LockKeyhole],
    [3, "Get instant access in My Library", "After verification, access is added to your account.", ShieldCheck],
  ] as const;
  return (
    <section className="section-y bg-card border-y border-border">
      <div className="page-container">
        <SectionHeading eyebrow="Simple by design" title="How it works" description="A clear path from checkout to study." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(([number, title, description, Icon]) => (
            <div key={number} className="rounded-xl border border-border bg-background p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{number}</span>
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><Mail className="h-4 w-4" aria-hidden="true" /> Confirmation may be sent by email or WhatsApp.</p>
      </div>
    </section>
  );
}

export function Testimonials({ items = [], stats }: { items?: ProofItem[]; stats?: Stats }) {
  const [active, setActive] = useState(0);
  if (!items.length && !stats) return null;
  const current = items[active % Math.max(items.length, 1)];
  return (
    <section className="section-y">
      <div className="page-container">
        <SectionHeading eyebrow="Student proof" title="What students say" description="Shown only when real review data is available." />
        {items.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-[1fr_auto]">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <p className="max-w-3xl font-serif text-2xl leading-tight">“{current.quote}”</p>
              <div className="mt-6">
                <p className="text-sm font-semibold">{current.name}</p>
                <p className="text-sm text-muted-foreground">{current.exam}</p>
              </div>
              <div className="mt-6 flex gap-2">
                {items.map((item, index) => <button key={item.name + index} aria-label={`Show testimonial ${index + 1}`} aria-current={index === active} onClick={() => setActive(index)} className={`h-3 min-w-3 rounded-full ${index === active ? "bg-primary" : "bg-border"}`} />)}
              </div>
            </div>
            {stats && (
              <div className="grid min-w-64 gap-3 sm:grid-cols-3 md:grid-cols-1">
                {[
                  ["Students helped", stats.studentsHelped],
                  ["Resources", stats.resources],
                  ["Exams covered", stats.examsCovered],
                ].filter(([, value]) => value).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border bg-card p-5"><p className="text-2xl font-serif font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
                ))}
              </div>
            )}
          </div>
        )}
        {!items.length && stats && (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Students helped", stats.studentsHelped],
              ["Resources", stats.resources],
              ["Exams covered", stats.examsCovered],
            ].filter(([, value]) => value).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-6"><p className="text-3xl font-serif font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function FAQ() {
  return (
    <section className="section-y bg-card border-y border-border">
      <div className="page-container grid gap-10 md:grid-cols-[.8fr_1.2fr]">
        <SectionHeading eyebrow="Need to know" title="Frequently asked questions" description="Straight answers before you buy." />
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map(([question, answer], index) => (
            <AccordionItem key={question} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base font-semibold">{question}</AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function CTABanner() {
  return (
    <section className="section-y">
      <div className="page-container">
        <div className="rounded-2xl border border-primary/20 bg-primary px-6 py-8 text-primary-foreground sm:px-10 sm:py-10">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-primary-foreground/75">Start with a free sample</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold">See the format before you commit.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/75">Explore the free library and decide what fits your preparation.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" variant="secondary" asChild><Link to="/free-resources">Get Free Samples</Link></Button>
              <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" asChild><Link to="/shop">Browse Shop</Link></Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{eyebrow}</p>}
      <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {description && <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}
    </div>
  );
}

function Home() {
  return (
    <>
      <Hero />
      <ExamGrid />
      <ResourceTypeGrid />
      <FeaturedResources />
      <HowItWorks />
      <Testimonials items={[]} stats={undefined} />
      <FAQ />
      <CTABanner />
    </>
  );
}
