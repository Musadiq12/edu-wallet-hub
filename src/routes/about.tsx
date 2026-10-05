import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Revivor CS Test Series" },
      { name: "description", content: "Learn about Revivor CS Test Series and its focused approach to CSEET, CS Executive and CS Professional preparation." },
      { property: "og:title", content: "About Revivor CS Test Series" },
      { property: "og:description", content: "A focused test-practice system for CSEET, CS Executive and CS Professional." },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="page-container section-y">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Revivor CS Test Series</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Prepare with a focused testing system.</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Revivor is built for students preparing for CSEET, CS Executive and CS Professional.
          The focus is simple: structured tests, expert checking, feedback and mentorship.
        </p>
        <div className="mt-10 space-y-8">
          <section>
            <h2 className="text-xl font-semibold">Structured Practice</h2>
            <p className="mt-2 text-muted-foreground">Choose chapter-wise or full-syllabus testing according to your stage and preparation plan.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">Expert Checking</h2>
            <p className="mt-2 text-muted-foreground">Selected plans are designed around expert checking and feedback so you can identify gaps instead of only collecting resources.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">One-year Access</h2>
            <p className="mt-2 text-muted-foreground">The current Revivor plans are configured for one year of access, with the exact scope shown on each product.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
