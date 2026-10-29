import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileCheck2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND, buildMeta, buildTitle } from "@/lib/seo";

export const Route = createFileRoute("/seller-agreement")({
  head: () => ({
    meta: [
      { title: buildTitle(["Seller Agreement", BRAND]) },
      { name: "description", content: buildMeta("Terms for creators who apply to sell original study resources on EduWallet.") },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: SellerAgreementPage,
});

function SellerAgreementPage() {
  return (
    <div className="page-container section-y">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <Button variant="ghost" asChild className="-ml-3 mb-5">
          <Link to="/become-seller"><ArrowLeft className="mr-2 size-4" />Back to application</Link>
        </Button>
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileCheck2 className="size-6" />
        </div>
        <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">EduWallet Seller Agreement</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Please read these conditions before applying to sell study resources on EduWallet.</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Original work and rights</h2>
            <p>You may upload only notes, summaries, study guides and other resources that you created yourself or are legally entitled to distribute and sell. Do not upload copyrighted books, paid course material, leaked examination papers, another creator’s work, or material that you are not authorized to share.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Accuracy and lawful content</h2>
            <p>You are responsible for the accuracy, quality and lawful nature of every resource you submit. Do not include another person’s personal information, fraudulent claims, malware, or content that violates applicable law or examination rules.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Review and moderation</h2>
            <p>Submitting an application does not automatically approve your seller account. EduWallet may request clarification, reject an application, reject or remove a product, or restrict seller access where content or account activity violates these conditions or applicable law.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Identity and payout details</h2>
            <p>You must provide truthful application information and a genuine ID document. Your identification information is used for seller verification and is not displayed publicly. Keep your UPI and other payout details accurate and notify support if they change.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Seller responsibility</h2>
            <p>You remain responsible for having the rights needed to sell the resources you upload. You must respond to legitimate content or ownership complaints and cooperate with reasonable verification requests.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Payments and platform terms</h2>
            <p>Seller eligibility, listing approval, payouts, refunds, fees and withholding periods are governed by the marketplace policies shown by EduWallet when those features are enabled. Applying alone does not guarantee approval, sales or payment.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Agreement</h2>
            <p>By accepting the agreement during your application, you confirm that the information you provide is accurate and that resources you upload will be your own original work or work you are legally authorized to distribute. You agree to follow these conditions and any applicable platform policies.</p>
          </section>
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm leading-6 text-muted-foreground">This agreement is a user-facing baseline. Have it reviewed for your operating jurisdiction and final marketplace payout/refund policy before launch.</p>
          </div>
          <Button asChild className="shrink-0"><Link to="/become-seller">Continue application</Link></Button>
        </div>
      </div>
    </div>
  );
}
