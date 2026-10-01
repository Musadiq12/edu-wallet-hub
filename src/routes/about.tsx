import { createFileRoute } from "@tanstack/react-router";
import { useSiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Beststudy" },
      { name: "description", content: "Learn about Beststudy and its educational resources for students in Jammu & Kashmir and beyond." },
      { property: "og:title", content: "About Beststudy" },
      { property: "og:description", content: "Beststudy provides study materials, notes, previous papers, important questions and educational updates." },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const s = useSiteSettings();
  return (
    <main className="page-container section-y">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">About {s.brandName}</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Making academic information easier to find</h1>
        <div className="mt-8 space-y-7 text-muted-foreground">
          <p className="text-lg">
            Beststudy is an educational resource platform focused on making useful academic information easier to access for students in Jammu & Kashmir and beyond.
          </p>
          <section><h2 className="text-xl font-semibold text-foreground">What you can find here</h2><p className="mt-2">Study materials, notes, previous papers, important questions, syllabus and exam updates, and guidance for students from 8th class through university level.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Academic coverage</h2><p className="mt-2">Resources may include material related to Kashmir University, Cluster University, Jammu University, IGNOU and other student-focused academic needs.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Our approach</h2><p className="mt-2">We aim to publish useful, timely and clearly organized educational information so students can spend less time searching and more time studying.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Independent educational resource</h2><p className="mt-2">Beststudy is independently operated and should not be treated as an official source for university, board or government decisions. For deadlines, results, notices and rules, verify important information against the relevant official authority.</p></section>
        </div>
      </div>
    </main>
  );
}
