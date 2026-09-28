import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — EduWallet" },
      { name: "description", content: "Privacy Policy explaining how EduWallet handles account, order, contact, payment and website data." },
      { property: "og:title", content: "Privacy Policy — EduWallet" },
      { property: "og:description", content: "How EduWallet collects, uses, stores and protects information." },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="page-container section-y">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Legal</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective date: 28 September 2026</p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground">
          <section><h2 className="text-xl font-semibold text-foreground">1. Information we collect</h2><p className="mt-2">We may collect account details such as your name, email address and WhatsApp number; order information such as the purchased resource, amount and transaction reference; payment proof you choose to upload; and messages you submit through the contact form.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">2. How we use information</h2><p className="mt-2">We use information to create and secure accounts, process and verify orders, provide purchased digital resources, respond to support requests, prevent abuse, maintain the website and improve the service.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">3. Payment information</h2><p className="mt-2">EduWallet does not ask you to provide your UPI PIN, bank password, card PIN or other authentication secrets. Payment confirmation data you submit is used to verify the corresponding order.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">4. Cookies and local storage</h2><p className="mt-2">The website may use browser storage for authentication, preferences and cookie-consent status. Where analytics is enabled, analytics technologies may also use cookies or similar identifiers. You can clear browser storage through your browser settings.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">5. Service providers</h2><p className="mt-2">EduWallet uses third-party services for hosting, authentication, database/storage, messaging, payment-related workflows and other site functionality. Those providers process information according to their own terms and privacy policies.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">6. Retention and security</h2><p className="mt-2">We retain information for as long as reasonably necessary for account management, order history, support, security, legal or operational purposes. We use access controls and row-level security where applicable, but no online system can be guaranteed completely secure.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">7. Your choices</h2><p className="mt-2">You may request correction of inaccurate account information and may contact us about questions regarding your data. Some information may need to be retained to complete orders, maintain records or meet legal obligations.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">8. Children</h2><p className="mt-2">The service is intended for students and general users. We do not knowingly request unnecessary personal information from children.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">9. Changes</h2><p className="mt-2">We may update this policy when the service or applicable requirements change. The current version will remain available on this page with its effective date.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">10. Contact</h2><p className="mt-2">For privacy questions, contact us through the <Link to="/contact" className="font-medium text-primary hover:underline">Contact page</Link>.</p></section>
        </div>
      </div>
    </main>
  );
}
