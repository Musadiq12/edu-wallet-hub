import { Link } from "@tanstack/react-router";
import { Instagram, Mail, MessageCircle, Send, Youtube } from "lucide-react";
import { Logo } from "@/components/Logo";
import { siteConfig } from "@/config/site";
import { isEmail, safeUrl, useSiteSettingsState, waLink } from "@/lib/settings";

const SITE_LINKS = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/free-resources", label: "Free Resources" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;


export function SiteFooter() {
  const { settings: s, ready } = useSiteSettingsState();
  const wa = waLink(s.whatsappNumber);
  const contacts = [
    isEmail(s.contactEmail) && { href: `mailto:${s.contactEmail}`, label: s.contactEmail, Icon: Mail },
    wa && { href: wa, label: "WhatsApp", Icon: MessageCircle },
    safeUrl(s.instagram) && { href: safeUrl(s.instagram), label: "Instagram", Icon: Instagram },
    safeUrl(s.telegram) && { href: safeUrl(s.telegram), label: "Telegram", Icon: Send },
    safeUrl(s.youtube) && { href: safeUrl(s.youtube), label: "YouTube", Icon: Youtube },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Mail }[];

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="page-container grid gap-10 py-12 md:grid-cols-3">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            {siteConfig.shortDescription}
          </p>
          {!ready ? (
            <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
              {[40, 24, 28].map((w) => (
                <div key={w} className="h-5 animate-pulse rounded bg-muted" style={{ width: `${w * 4}px` }} />
              ))}
            </div>
          ) : contacts.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 text-sm animate-in fade-in duration-300">
              {contacts.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </a>
              ))}
            </div>
          )}
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

      </div>

      <div className="border-t border-border">
        <div className="page-container flex flex-col gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {siteConfig.copyrightYear} {s.brandName}. All rights reserved.
          </p>
          <p className="max-w-xl sm:text-right">{siteConfig.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
