import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Beststudy" },
      {
        name: "description",
        content: "Terms and conditions for using Beststudy and purchasing its digital educational resources.",
      },
      { property: "og:title", content: "Terms & Conditions — Beststudy" },
      {
        property: "og:description",
        content: "Terms and conditions for Beststudy accounts, purchases, payments, delivery, and digital resources.",
      },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="page-container section-y">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Legal</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          Terms & Conditions
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective date: 28 September 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of these terms</h2>
            <p className="mt-2">By creating an account, using Beststudy, submitting an order, or purchasing a resource, you agree to these Terms & Conditions. If you do not agree, please do not use the website or purchase its resources.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Educational resources</h2>
            <p className="mt-2">Beststudy provides digital educational materials such as notes, guess papers, study guides, solved papers, assignment guidance, and exam-oriented resources. These materials are intended to support study and preparation and are not a substitute for official course material, university instructions, or your own academic work.</p>
            <p className="mt-2">Availability, page count, format, included items, and other product details are described on the relevant product page and may vary between resources.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Accounts and accurate information</h2>
            <p className="mt-2">You are responsible for providing accurate account, contact, and payment information and for keeping your login credentials secure. Your account and purchased library access are intended for your personal use unless we expressly agree otherwise.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Orders and payment verification</h2>
            <p className="mt-2">Purchases are currently processed through the payment method shown at checkout. Payment confirmation is subject to manual verification. An order is not treated as successfully verified merely because a payment screenshot or transaction reference has been submitted.</p>
            <p className="mt-2">You must provide genuine transaction details and must not submit false, altered, or misleading payment information.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Delivery and My Library</h2>
            <p className="mt-2">After payment verification, eligible purchased resources may be made available through My Library and/or delivered through the contact method provided at checkout. Access can depend on the availability of the purchased file and successful verification of the order.</p>
            <p className="mt-2">Secure access links may expire and may need to be generated again. You must be logged into the account associated with the verified purchase to access protected resources.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Digital products, refunds and access issues</h2>
            <p className="mt-2">Because products are digital, you should review the product description, format, included contents, and price before completing payment. Once access or delivery has been provided, a refund may not be available solely because you changed your mind or no longer need the resource.</p>
            <p className="mt-2">If you paid successfully but did not receive the purchased resource, received an incorrect file, or experience a material access problem, contact Beststudy with your order details so the issue can be reviewed and, where appropriate, corrected.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Intellectual property and permitted use</h2>
            <p className="mt-2">Unless otherwise stated, Beststudy's original website content, branding, layouts, and original educational resources are protected by applicable intellectual-property laws. A purchase grants you access to the purchased resource for your personal study use; it does not transfer ownership of the underlying intellectual property.</p>
            <p className="mt-2">You must not resell, redistribute, publicly upload, share access credentials, or commercially distribute purchased files without permission from the applicable rights holder.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Academic responsibility</h2>
            <p className="mt-2">You remain responsible for your submissions, exam preparation, citations, and compliance with the rules of your university, examination body, or course provider. Beststudy does not guarantee a particular grade, examination result, admission, or academic outcome.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Website availability and changes</h2>
            <p className="mt-2">We may update, replace, suspend, or discontinue website features, products, pricing, or availability from time to time. We will not intentionally remove access to a verified purchase without a legitimate reason, but temporary interruptions may occur because of maintenance, hosting, storage, payment verification, or technical issues.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Prohibited use</h2>
            <p className="mt-2">You must not use Beststudy to commit fraud, interfere with the website or its security, attempt unauthorized access, abuse payment or account systems, or misuse another person's account or purchased resources.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Third-party services</h2>
            <p className="mt-2">Beststudy may rely on third-party services for hosting, authentication, storage, payments, messaging, analytics, or other functionality. Their availability and separate terms may affect parts of the service.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">12. Contact and support</h2>
            <p className="mt-2">For payment, delivery, account, or access issues, contact Beststudy through the <Link to="/contact" className="font-medium text-primary hover:underline">Contact page</Link> and include your order details where relevant.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">13. Changes to these terms</h2>
            <p className="mt-2">We may update these terms when the service, products, or applicable requirements change. The updated version will be published on this page with a revised effective date. Your continued use of Beststudy after an update constitutes acceptance of the updated terms to the extent permitted by applicable law.</p>
          </section>
          <section className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs leading-6">These terms are provided as general website terms and do not replace professional legal advice. If a provision is found unenforceable, the remaining provisions will continue to apply to the extent permitted by applicable law.</p>
          </section>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <Link to="/shop" className="text-sm font-medium text-primary hover:underline">← Back to Shop</Link>
        </div>
      </div>
    </main>
  );
}
