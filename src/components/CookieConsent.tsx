import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import "./cookie-consent.css";
import { CONSENT_LIFETIME_DAYS, CONSENT_POLICY_VERSION, CONSENT_STORAGE_KEY, type ConsentChoices } from "@/lib/consent";

type OptionalCategory = "analytics" | "marketing" | "functional";
type Choices = { analytics: boolean; marketing: boolean; functional: boolean };
type Consent = ConsentChoices;
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; __eduWalletConsent?: Consent | null; } }

const defaultChoices: Choices = { analytics: false, marketing: false, functional: false };
const descriptions: Record<OptionalCategory, string> = {
  analytics: "Helps us understand which pages are useful. Analytics tools are not loaded unless you enable this category.",
  marketing: "Allows advertising and campaign measurement technologies. These stay off unless you enable this category.",
  functional: "Remembers optional preferences that are not required for the website to work.",
};

function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Consent;
    if (!value || value.policyVersion !== CONSENT_POLICY_VERSION || Date.parse(value.expiresAt) <= Date.now()) return null;
    if (value.necessary !== true || typeof value.analytics !== "boolean" || typeof value.marketing !== "boolean" || typeof value.functional !== "boolean") return null;
    return value;
  } catch { return null; }
}
function applyGoogleConsent(choices: Choices) {
  window.gtag?.("consent", "update", {
    ad_storage: choices.marketing ? "granted" : "denied",
    analytics_storage: choices.analytics ? "granted" : "denied",
    ad_user_data: choices.marketing ? "granted" : "denied",
    ad_personalization: choices.marketing ? "granted" : "denied",
    functionality_storage: choices.functional ? "granted" : "denied",
    personalization_storage: choices.functional ? "granted" : "denied",
    security_storage: "granted",
  });
}

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [choices, setChoices] = useState<Choices>(defaultChoices);
  const [showBanner, setShowBanner] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const stored = readConsent();
    setConsent(stored);
    window.__eduWalletConsent = stored;
    setChoices(stored ? { analytics: stored.analytics, marketing: stored.marketing, functional: stored.functional } : defaultChoices);
    if (stored) {
      applyGoogleConsent(stored);
      window.dispatchEvent(new CustomEvent("eduwallet:consent-changed", { detail: stored }));
      setShowBanner(false);
    } else {
      // Delay is only presentation timing. No optional vendor should run while the choice is pending.
      const timer = window.setTimeout(() => setShowBanner(true), 90_000);
      setReady(true);
      return () => window.clearTimeout(timer);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    firstChoiceRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setDialogOpen(false); openerRef.current?.focus(); openerRef.current = null; return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hasAttribute("hidden"));
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen]);

  const recordChoice = useCallback(async (nextChoices: Choices) => {
    const timestamp = new Date();
    const record: Consent = {
      necessary: true, ...nextChoices, policyVersion: CONSENT_POLICY_VERSION, timestamp: timestamp.toISOString(),
      expiresAt: new Date(timestamp.getTime() + CONSENT_LIFETIME_DAYS * 86400000).toISOString(),
      jurisdiction: "unknown", consentId: crypto.randomUUID(),
    };
    try { localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record)); } catch { /* preference still applies in memory */ }
    window.__eduWalletConsent = record;
    applyGoogleConsent(nextChoices);
    if (!nextChoices.analytics) document.querySelectorAll("script[data-edu-analytics],script[data-edu-analytics-init],script[data-consent-category=\"analytics\"]").forEach((script) => script.remove());
    if (!nextChoices.marketing) document.querySelectorAll('script[data-consent-category="marketing"]').forEach((script) => script.remove());
    if (!nextChoices.functional) document.querySelectorAll('script[data-consent-category="functional"]').forEach((script) => script.remove());
    if (!nextChoices.marketing) window.dispatchEvent(new CustomEvent("eduwallet:do-not-sell-share", { detail: { optedOut: true } }));
    setConsent(record); setChoices(nextChoices); setShowBanner(false); setDialogOpen(false);
    try {
      const url = import.meta.env["VITE_SUPABASE_URL"], key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
      if (url && key) await fetch(`${url}/rest/v1/cookie_consent_records`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          consent_id: record.consentId, policy_version: record.policyVersion, jurisdiction: record.jurisdiction,
          categories: { necessary: true, analytics: nextChoices.analytics, marketing: nextChoices.marketing, functional: nextChoices.functional },
        }),
      });
    } catch { /* local preference remains authoritative if audit logging fails */ }
    window.dispatchEvent(new CustomEvent("eduwallet:consent-changed", { detail: record }));
    if (openerRef.current) { openerRef.current.focus(); openerRef.current = null; }
  }, []);

  useEffect(() => {
    const reopen = () => {
      openerRef.current = document.activeElement as HTMLElement;
      const stored = readConsent();
      setChoices(stored ? { analytics: stored.analytics, marketing: stored.marketing, functional: stored.functional } : defaultChoices);
      setDialogOpen(true);
    };
    window.addEventListener("eduwallet:open-cookie-settings", reopen);
    return () => window.removeEventListener("eduwallet:open-cookie-settings", reopen);
  }, []);
  const openCustomize = () => { openerRef.current = document.activeElement as HTMLElement; setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); openerRef.current?.focus(); };
  const chooseAll = (enabled: boolean) => void recordChoice({ analytics: enabled, marketing: enabled, functional: enabled });
  if (!ready) return null;

  return <>
    {showBanner && <aside className="ew-cookie-banner" role="region" aria-label="Cookie consent">
      <div className="ew-cookie-banner__copy">
        <p className="ew-cookie-eyebrow">EDUWALLET · PRIVACY</p>
        <h2 className="text-base font-semibold">Your privacy, your choice</h2>
        <p className="mt-1 text-sm leading-6">We use essential storage to keep this site secure and working. Optional analytics, preferences and advertising stay off unless you choose to enable them. Read our <Link to="/privacy" className="font-medium underline underline-offset-2">Privacy Policy</Link> and <Link to="/cookies" className="font-medium underline underline-offset-2">Cookie Policy</Link>.</p>
        <button type="button" className="ew-cookie-optout" onClick={() => {
          setChoices((current) => ({ ...current, marketing: false }));
          openerRef.current = document.activeElement as HTMLElement;
          setDialogOpen(true);
        }}>Do Not Sell or Share My Personal Information</button>
      </div>
      <div className="ew-cookie-banner__actions">
        <Button onClick={() => void chooseAll(true)}>Accept</Button>
        <Button variant="outline" onClick={() => void chooseAll(false)}>Reject</Button>
        <Button variant="outline" onClick={openCustomize}>Manage</Button>
      </div>
    </aside>}
    {dialogOpen && <div className="ew-cookie-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section ref={dialogRef} className="ew-cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="ew-cookie-title" aria-describedby="ew-cookie-description" tabIndex={-1}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="ew-cookie-eyebrow">EDUWALLET · PRIVACY CENTRE</p><h2 id="ew-cookie-title" className="text-xl font-semibold">Manage cookie preferences</h2><p id="ew-cookie-description" className="mt-2 text-sm leading-6">Choose the optional technologies you are comfortable with. You can revisit these settings any time using Cookie settings in the footer.</p></div>
          <button type="button" aria-label="Close cookie preferences" className="rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2" onClick={closeDialog}>×</button>
        </div>
        <div className="mt-5 space-y-3">
          <div className="ew-cookie-category"><div><p className="font-medium">Strictly necessary</p><p className="mt-1 text-sm text-muted-foreground">Needed for security, sign-in, checkout and saving your privacy choices. Always active.</p></div><span className="text-sm font-semibold">Always on</span></div>
          {(["analytics", "functional", "marketing"] as OptionalCategory[]).map((category) => <div className="ew-cookie-category" key={category}>
            <div className="pr-3"><p className="font-medium">{category === "analytics" ? "Analytics" : category === "marketing" ? "Marketing and advertising" : "Preferences"}</p><p className="mt-1 text-sm text-muted-foreground">{descriptions[category]}</p></div>
            <label className="ew-switch"><input type="checkbox" checked={choices[category]} onChange={(event) => setChoices((current) => ({ ...current, [category]: event.target.checked }))} aria-label={`Enable ${category} cookies`} /><span aria-hidden="true" /></label>
          </div>)}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={firstChoiceRef} variant="outline" onClick={() => void chooseAll(false)}>Reject all</Button>
          <Button variant="outline" onClick={() => void recordChoice(choices)}>Save preferences</Button>
          <Button onClick={() => void chooseAll(true)}>Accept all</Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Your choice is saved for {CONSENT_LIFETIME_DAYS} days. Policy version: {CONSENT_POLICY_VERSION}.</p>
      </section>
    </div>}
  </>;
}
