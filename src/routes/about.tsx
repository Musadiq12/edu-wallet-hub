import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, breadcrumbJson, jsonLd } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About EduWallet" },
      { name: "description", content: "Learn about EduWallet, its educational resources, access process, and student-focused mission." },
      { property: "og:title", content: "About EduWallet" },
      { property: "og:description", content: "Learn about EduWallet and how its digital study resources support students." },
    ],
      { property: "og:url", content: new URL("/about", SITE_URL).toString() },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "About EduWallet" },
      { name: "twitter:description", content: siteConfig.shortDescription },
    ],
    links: [{ rel: "canonical", href: new URL("/about", SITE_URL).toString() }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="page-container section-y">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson([{ name: "Home", path: "/" }, { name: "About", path: "/about" }]) }} />
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          About EduWallet
        </h1>

        <p className="mt-5 text-lg text-muted-foreground">
          EduWallet is a student-focused platform created to make exam
          preparation more affordable, simple, and accessible.
        </p>

        <div className="mt-10 space-y-8">
          <section>
            <h2 className="text-xl font-semibold">Affordable Resources</h2>
            <p className="mt-2 text-muted-foreground">
              We believe useful study material should be accessible to
              students without being unnecessarily expensive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">What We Offer</h2>
            <p className="mt-2 text-muted-foreground">
              EduWallet provides exam-focused notes, guess papers, important
              questions, study guides, solved papers, assignment guidance, and other
              digital resources for students preparing across different exams.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Built for Students</h2>
            <p className="mt-2 text-muted-foreground">
              Our resources are designed to help students save time, focus on
              important topics, and prepare for their exams more efficiently.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Our Goal</h2>
            <p className="mt-2 text-muted-foreground">
              Our goal is simple: make quality educational resources easier
              to find, easier to understand, and affordable for students.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}