import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/free-resources")({
  head: () => ({
    meta: [
      { title: "Free Sample — Revivor CS Test Series" },
      {
        name: "description",
        content: "Try a Revivor CS Test Series sample before choosing your CSEET, CS Executive or CS Professional plan.",
      },
      { property: "og:title", content: "Free Sample — Revivor CS Test Series" },
      {
        property: "og:description",
        content: "Try a Revivor CS Test Series sample before choosing your plan.",
      },
    ],
    links: [{ rel: "canonical", href: "/free-resources" }],
  }),
  component: FreeResources,
});

function FreeResources() {
  return (
    <main className="page-container section-y">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-amber-50 p-6 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Revivor CS Test Series</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Try the Free Sample</h1>
        <p className="mt-4 text-sm leading-7 text-amber-950/70">
          Get a sample before choosing a CSEET, CS Executive or CS Professional test series.
        </p>
        <Link
          to="/"
          hash="sample"
          className="mt-7 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3.5 font-bold text-white hover:bg-slate-800"
        >
          Get Free Sample
        </Link>
      </div>
    </main>
  );
}
