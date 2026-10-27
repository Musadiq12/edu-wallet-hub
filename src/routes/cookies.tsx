import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [
    { title: "Cookie Policy — EduWallet" },
    { name: "description", content: "How EduWallet uses essential browser storage and optional technologies, and how to change your choices." },
    { name: "robots", content: "index, follow" },
  ] }),
  component: CookiePolicy,
});

function CookiePolicy() {
  return <article className="page-container mx-auto max-w-3xl py-12 sm:py-16">
    <p className="text-sm font-medium text-muted-foreground">Privacy and transparency</p>
    <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Cookie Policy</h1>
    <p className="mt-4 text-sm text-muted-foreground">Last reviewed: 27 October 2026.</p>
    <p className="mt-5 leading-7">This policy explains how EduWallet Hub uses cookies and similar browser technologies. We aim to use essential storage only where needed to provide a service you request, and to keep optional analytics, advertising and preference technologies off unless you choose to enable them. The exact cookies and vendors used must be kept aligned with the services actually enabled on this website.</p>
    <section className="mt-8 space-y-3"><h2 className="text-xl font-semibold">What are cookies?</h2><p>Cookies are small files stored by your browser. Similar technologies can include local storage, pixels, SDKs and scripts that read or store information on your device.</p></section>
    <section className="mt-6 space-y-3"><h2 className="text-xl font-semibold">Categories we use</h2><p><strong>Strictly necessary:</strong> support core functions such as security, account sign-in, checkout and remembering your privacy choice. These are always active where needed for the service.</p><p><strong>Analytics:</strong> help us understand visits and improve pages. This category should list the actual analytics provider, data collected and retention period before the tool is enabled.</p><p><strong>Preferences:</strong> remember optional settings. The specific technologies and retention periods should be listed here before use.</p><p><strong>Marketing and advertising:</strong> support advertising or campaign measurement. The actual vendors, purposes and cookie lifetimes must be disclosed here before those tools are enabled.</p></section>
    <section className="mt-6 space-y-3"><h2 className="text-xl font-semibold">Your choices</h2><p>You can Accept, Reject or Manage optional technologies in the notice. You can change or withdraw your choice at any time using Cookie settings in the footer. Rejecting optional technologies should not prevent you from using core features. Essential storage remains active where required for security or a service you request.</p><button type="button" className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent" onClick={() => window.dispatchEvent(new CustomEvent("eduwallet:open-cookie-settings"))}>Open Cookie settings</button></section>
    <section className="mt-6 space-y-3"><h2 className="text-xl font-semibold">Legal and privacy context</h2><p>EduWallet is designed with privacy and transparency in mind. India’s Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 have phased commencement dates. We do not represent this cookie interface alone as proof of legal compliance. Where visitors or services are subject to other laws, additional requirements may apply.</p><p>We will update this policy when our technologies, vendors or applicable requirements change.</p></section>
    <section className="mt-6 space-y-3"><h2 className="text-xl font-semibold">Contact and data controller</h2><p>For privacy questions, contact the operator identified in the <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>. Before publication, the site owner must verify that the privacy policy contains the current legal operator name and a monitored contact address.</p></section>
  </article>;
}
