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
  marketing: "Allows advertising and measurement technologies, including eligible ad pixels and advertising cookies.",
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
    // Consent defaults are installed once before React mounts by the bootstrap snippet.
    const stored = readConsent();
    setConsent(stored);
    setChoices(stored ? { analytics: stored.analytics, marketing: stored.marketing, functional: stored.functional } : defaultChoices);
    if (stored) applyGoogleConsent(stored);
    setShowBanner(!stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    firstChoiceRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setDialogOpen(false); return; }
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
      // Static client cannot reliably infer legal jurisdiction; production geo-based defaults need a CMP/edge signal before tags initialize.
      jurisdiction: "unknown", consentId: crypto.randomUUID(),
    };
    try { localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record)); } catch { /* in-memory choice still applies */ }
    window.__eduWalletConsent = record;
    applyGoogleConsent(nextChoices);
    if (!nextChoices.analytics) document.querySelectorAll("script[data-edu-analytics]").forEach((script) => script.remove());
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
    } catch { /* audit persistence is not required for the actual choice */ }
    window.dispatchEvent(new CustomEvent("eduwallet:consent-changed", { detail: record }));
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
        <h2 className="text-base font-semibold">Your privacy choices</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Essential storage keeps EduWallet working. Optional analytics, advertising and preference technologies stay off until you choose them. Read our <Link to="/privacy" className="font-medium underline underline-offset-2">Privacy Policy</Link> and <Link to="/cookies" className="font-medium underline underline-offset-2">Cookie Policy</Link>.</p>
      </div>
      <div className="ew-cookie-banner__actions">
        <Button variant="outline" onClick={() => void chooseAll(true)}>Accept all</Button>
        <Button variant="outline" onClick={() => void chooseAll(false)}>Reject all</Button>
        <Button onClick={openCustomize}>Customize</Button>
      </div>
    </aside>}
    {dialogOpen && <div className="ew-cookie-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section ref={dialogRef} className="ew-cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="ew-cookie-title" aria-describedby="ew-cookie-description" tabIndex={-1}>
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="ew-cookie-title" className="text-xl font-semibold">Cookie preferences</h2><p id="ew-cookie-description" className="mt-2 text-sm leading-6 text-muted-foreground">Choose which optional technologies EduWallet may use. Change or withdraw your choices anytime from Cookie settings.</p></div>
          <button type="button" aria-label="Close cookie preferences" className="rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2" onClick={closeDialog}>×</button>
        </div>
        <div className="mt-5 space-y-3">
          <div className="ew-cookie-category"><div><p className="font-medium">Strictly Necessary</p><p className="mt-1 text-sm text-muted-foreground">Required for sign-in, security, checkout, and remembering your consent. These cannot be switched off.</p></div><span className="text-sm font-semibold">Always on</span></div>
          {(["analytics", "marketing", "functional"] as OptionalCategory[]).map((category) => <div className="ew-cookie-category" key={category}>
            <div className="pr-3"><p className="font-medium">{category === "analytics" ? "Analytics" : category === "marketing" ? "Marketing / Advertising" : "Functional / Preferences"}</p><p className="mt-1 text-sm text-muted-foreground">{descriptions[category]}</p></div>
            <label className="ew-switch"><input type="checkbox" checked={choices[category]} onChange={(event) => setChoices((current) => ({ ...current, [category]: event.target.checked }))} aria-label={`Enable ${category} cookies`} /><span aria-hidden="true" /></label>
          </div>)}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={firstChoiceRef} variant="outline" onClick={() => void chooseAll(false)}>Reject all</Button>
          <Button variant="outline" onClick={() => void recordChoice(choices)}>Save preferences</Button>
          <Button onClick={() => void chooseAll(true)}>Accept all</Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Choice stored for {CONSENT_LIFETIME_DAYS} days. Policy version: {CONSENT_POLICY_VERSION}.</p>
      </section>
    </div>}
    {consent && !showBanner && <button type="button" className="ew-cookie-settings" onClick={openCustomize} aria-label="Open cookie settings">Cookie settings</button>}
  </>;
}
