import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { siteConfig, whatsappLink } from "@/config/site";

const SITE_LINKS = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/free-resources", label: "Free Resources" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/faq", label: "FAQ" },
] as const;

const LEGAL_LINKS = [
  { to: "/terms", label: "Terms & Conditions" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/disclaimer", label: "Disclaimer" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="page-container grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            {siteConfig.shortDescription}
          </p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {siteConfig.contactEmail}
            </a>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp {siteConfig.whatsappNumber}
            </a>
          </div>
        </div>

        <nav aria-label="Footer navigation">
          <h2 className="font-serif text-sm font-semibold tracking-wide text-foreground uppercase">
            Explore
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {SITE_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className="font-serif text-sm font-semibold tracking-wide text-foreground uppercase">
            Legal
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="page-container flex flex-col gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {siteConfig.copyrightYear} {siteConfig.brandName}. All rights reserved.
          </p>
          <p className="max-w-xl sm:text-right">{siteConfig.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
