export const CONSENT_POLICY_VERSION = "2026-10-v1";
export const CONSENT_STORAGE_KEY = "eduwallet-consent-v2";
export const CONSENT_LIFETIME_DAYS = 180;

export type ConsentChoices = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  policyVersion: string;
  timestamp: string;
  expiresAt: string;
  jurisdiction: string;
  consentId: string;
};

export type ConsentCategory = "analytics" | "marketing" | "functional";

export function readConsentChoices(): ConsentChoices | null {
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || "null") as ConsentChoices | null;
    if (!value || value.policyVersion !== CONSENT_POLICY_VERSION || Date.parse(value.expiresAt) <= Date.now()) return null;
    if (value.necessary !== true || !["analytics", "marketing", "functional"].every((key) => typeof value[key as ConsentCategory] === "boolean")) return null;
    return value;
  } catch {
    return null;
  }
}

/** Load a third-party script only after its category is granted. Do not use this for scripts that must not run before consent. */
export function loadConsentGatedScript(src: string, category: ConsentCategory, attributes: Record<string, string> = {}) {
  const consent = readConsentChoices();
  if (!consent?.[category]) return null;
  const existing = document.querySelector<HTMLScriptElement>(`script[data-consent-src="${CSS.escape(src)}"]`);
  if (existing) return existing;
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset["consentSrc"] = src;
  script.dataset["consentCategory"] = category;
  Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
  document.head.appendChild(script);
  return script;
}

/** Consent withdrawal is immediate for future loads; remove dynamically loaded scripts where possible. Third-party cookies may persist until vendor cleanup/expiry. */
export function unloadConsentGatedScripts(category: ConsentCategory) {
  document.querySelectorAll<HTMLScriptElement>(`script[data-consent-category="${category}"]`).forEach((script) => script.remove());
}
