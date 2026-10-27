import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [
    { title: "Cookie Policy — EduWallet" },
    { name: "description", content: "How EduWallet uses essential browser storage and optional technologies." },
    { name: "robots", content: "index, follow" },
  ] }),
  component: CookiePolicy,
});

function CookiePolicy() {
  return <article className="page-container mx-auto max-w-3xl py-12 sm:py-16">
    <p className="text-sm font-medium text-muted-foreground">Policy template · Review before publication</p>
    <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Cookie Policy</h1>
    <p className="mt-4 text-sm text-muted-foreground">Last reviewed: 27 October 2026. This template must be checked and completed by the site owner before being treated as final legal policy.</p>
    <section className="mt-8 space-y-3"><h2 className="text-xl font-semibold">What browser storage we use</h2><p>EduWallet uses strictly necessary storage for security, authentication, and remembering your privacy choices. Optional analytics, functional preference, and advertising technologies should only run when enabled in Cookie settings, where consent is legally required.</p></section>
    <section className="mt-6 space-y-3"><h2 className="text-xl font-semibold">Categories</h2><p><strong>Strictly necessary:</strong> required to provide core functions and protect the site.</p><p><strong>Analytics:</strong> helps us understand site usage; vendor and retention periods must be listed here before enabling analytics.</p><p><strong>Functional / preferences:</strong> remembers optional choices; list actual technologies and retention periods here.</p><p><strong>Marketing / advertising:</strong> supports advertising and campaign measurement; list each vendor, purpose, and lifetime here before enabling it.</p></section>
    <section className="mt-6 space-y-3"><h2 className="text-xl font-semibold">Manage your choices</h2><p>Use the persistent Cookie settings control in the website footer to change or withdraw your optional choices. Withdrawal applies prospectively; some third-party cookies may need to be removed on their own domains or expire according to the vendor's policy.</p><button type="button" className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent" onClick={() => window.dispatchEvent(new CustomEvent("eduwallet:open-cookie-settings"))}>Open Cookie settings</button></section>
    <section className="mt-6 space-y-3"><h2 className="text-xl font-semibold">Contact</h2><p>Questions about this policy: <strong>[ADD DATA CONTROLLER NAME, CONTACT EMAIL, AND POSTAL ADDRESS]</strong>.</p></section>
    <p className="mt-8 text-sm text-muted-foreground">Related: <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.</p>
  </article>;
}
