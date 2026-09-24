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
  | "websiteUrl";

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
];

export type SiteSettings = Record<SettingKey, string>;

export const defaultSettings: SiteSettings = {
  brandName: siteConfig.brandName,
  tagline: siteConfig.tagline,
  contactEmail: siteConfig.contactEmail,
  whatsappNumber: "",
  upiId: siteConfig.upiId,
  upiPayeeName: siteConfig.upiPayeeName,
  qrCodeUrl: siteConfig.qrCodeUrl,
  deliveryEstimate: siteConfig.deliveryEstimate,
  instagram: siteConfig.social.instagram,
  telegram: siteConfig.social.telegram,
  youtube: siteConfig.social.youtube,
  websiteUrl: siteConfig.websiteUrl,
};

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["site-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase.from("site_settings").select("key,value");
      if (error) return defaultSettings;
      const merged = { ...defaultSettings };
      for (const row of data ?? []) {
        const k = row.key as SettingKey;
        if (k in merged && row.value != null && row.value !== "") merged[k] = row.value;
      }
      return merged;
    },
  });

/** Merged settings: database values override the defaults in src/config/site.ts. */
export function useSiteSettings(): SiteSettings {
  const { data } = useQuery(settingsQuery());
  return data ?? defaultSettings;
}

export async function saveSettings(values: Partial<SiteSettings>) {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value: value ?? "" }));
  if (!rows.length) return;
  const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

export const waLink = (number: string, message?: string) =>
  `https://wa.me/${number.replace(/[^0-9]/g, "")}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

export const upiLink = (upiId: string, payee: string, amount: number, note: string) =>
  `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
