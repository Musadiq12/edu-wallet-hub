import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/config/site";

/** Keys stored in the editable site_settings table. */
export type SettingKey =
  | "brandName"
  | "tagline"
  | "contactEmail"
  | "whatsappNumber"
  | "upiId"
  | "upiPayeeName"
  | "qrCodeUrl"
  | "deliveryEstimate"
  | "instagram"
  | "telegram"
  | "youtube"
  | "websiteUrl"
  | "logoUrl"
  | "faviconUrl"
  | "ogImageUrl"
  | "seoTitle"
  | "seoDescription"
  | "footerText"
  | "studentCount"
  | "rating"
  | "ratingCount"
  | "heroHeading"
  | "heroSubline"
  | "heroPrimaryCta"
  | "heroSecondaryCta";

export const SETTING_FIELDS: { key: SettingKey; label: string; help?: string }[] = [
  { key: "brandName", label: "Website name" },
  { key: "tagline", label: "Tagline" },
  { key: "contactEmail", label: "Contact email" },
  { key: "whatsappNumber", label: "WhatsApp number", help: "Include country code, e.g. +919876543210" },
  { key: "upiId", label: "UPI ID" },
  { key: "upiPayeeName", label: "UPI payee name" },
  { key: "qrCodeUrl", label: "UPI QR image URL", help: "Leave empty to show an automatically generated QR code" },
  { key: "deliveryEstimate", label: "Delivery estimate text" },
  { key: "websiteUrl", label: "Website URL" },
  { key: "instagram", label: "Instagram link" },
  { key: "telegram", label: "Telegram link" },
  { key: "youtube", label: "YouTube link" },
  { key: "logoUrl", label: "Logo URL" }, { key: "faviconUrl", label: "Favicon URL" }, { key: "ogImageUrl", label: "OG image URL" },
  { key: "seoTitle", label: "SEO title" }, { key: "seoDescription", label: "SEO description" }, { key: "footerText", label: "Footer text" },
  { key: "studentCount", label: "Student count" }, { key: "rating", label: "Rating" }, { key: "ratingCount", label: "Rating count label" },
  { key: "heroHeading", label: "Hero heading" }, { key: "heroSubline", label: "Hero subtext" }, { key: "heroPrimaryCta", label: "Hero primary CTA" }, { key: "heroSecondaryCta", label: "Hero secondary CTA" },
];

export type SiteSettings = Record<SettingKey, string>;

/** Used only if the database cannot be reached. Contact/payment values stay empty so nothing stale is shown. */
export const defaultSettings: SiteSettings = {
  brandName: siteConfig.fallbackBrand.brandName,
  tagline: siteConfig.fallbackBrand.tagline,
  contactEmail: "",
  whatsappNumber: "",
  upiId: "",
  upiPayeeName: "",
  qrCodeUrl: "",
  deliveryEstimate: "",
  instagram: "",
  telegram: "",
  youtube: "",
  websiteUrl: "",
  logoUrl: "", faviconUrl: "", ogImageUrl: "", seoTitle: "", seoDescription: "", footerText: "", studentCount: "", rating: "", ratingCount: "", heroHeading: "", heroSubline: "", heroPrimaryCta: "", heroSecondaryCta: "",
};

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["site-settings"],
    staleTime: 30_000,
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase.from("site_settings").select("key,value");
      if (error) return defaultSettings;
      const merged = { ...defaultSettings };
      for (const row of data ?? []) {
        const k = row.key as SettingKey;
        if (k in merged && row.value != null) merged[k] = row.value.trim();
      }
      return merged;
    },
  });

/** Settings from the site_settings table (single source of truth, edited in Admin → Settings). */
export function useSiteSettings(): SiteSettings {
  const { data } = useQuery(settingsQuery());
  return data ?? defaultSettings;
}

/** Same as useSiteSettings, plus whether real data has arrived (for skeletons). */
export function useSiteSettingsState(): { settings: SiteSettings; ready: boolean } {
  const { data } = useQuery(settingsQuery());
  return { settings: data ?? defaultSettings, ready: !!data };
}

/** Saves only the given keys; other settings rows are untouched. */
export async function saveSettings(values: Partial<SiteSettings>) {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value: (value ?? "").trim() }));
  if (!rows.length) return;
  const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

/** Extracts a safe http(s) URL from a value (tolerates extra pasted text). Returns "" if none. */
export function safeUrl(value: string): string {
  const m = (value ?? "").match(/https?:\/\/[^\s"'<>]+/i);
  if (m) return m[0];
  const v = (value ?? "").trim();
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return `https://${v}`;
  return "";
}

export const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test((v ?? "").trim());

export const waLink = (number: string, message?: string) => {
  const digits = (number ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 8) return "";
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
};

export const upiLink = (upiId: string, payee: string, amount: number, note: string) =>
  `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
