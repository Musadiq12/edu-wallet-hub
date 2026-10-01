import { Link } from "@tanstack/react-router";
import { Instagram, Mail, Send, Youtube } from "lucide-react";
import { Logo } from "@/components/Logo";
import { siteConfig } from "@/config/site";
import { isEmail, safeUrl, useSiteSettingsState } from "@/lib/settings";

export function SiteFooter() {
  const { settings: s } = useSiteSettingsState();
  const email = isEmail(s.contactEmail) ? s.contactEmail : "";
  const telegram = safeUrl(s.telegram);
  const youtube = safeUrl(s.youtube);

  return (
    <footer className="border-t border-border bg-card">
      <div className="page-container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">A focused digital library for students who want useful exam resources without the clutter.</p>
        </div>

        <nav aria-label="Explore">
          <h2 className="font-serif text-sm font-semibold">Explore</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link to="/shop" className="text-muted-foreground hover:text-foreground">Shop</Link></li>
            <li><Link to="/free-resources" className="text-muted-foreground hover:text-foreground">Free Resources</Link></li>
            <li><Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
            <li><Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className="font-serif text-sm font-semibold">Legal</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link></li>
            <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link></li>
            <li><Link to="/terms" className="text-muted-foreground hover:text-foreground">Refund Policy</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="font-serif text-sm font-semibold">Connect</h2>
          <div className="mt-4 space-y-3 text-sm">
            {email && <a href={`mailto:${email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Mail className="h-4 w-4" aria-hidden="true" /> {email}</a>}
            {telegram && <a href={telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Send className="h-4 w-4" aria-hidden="true" /> Telegram</a>}
            {youtube && <a href={youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Youtube className="h-4 w-4" aria-hidden="true" /> YouTube</a>}
            {safeUrl(s.instagram) && <a href={safeUrl(s.instagram)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Instagram className="h-4 w-4" aria-hidden="true" /> Instagram</a>}
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="page-container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
          <p>© 2026 EduWallet. All rights reserved.</p>
          <p className="max-w-3xl sm:text-right">{siteConfig.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
