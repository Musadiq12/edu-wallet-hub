import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const announcementMessageSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/),
  text: z.string().trim().min(1).max(160),
  url: z.string().trim().max(500).refine((value) => !value || safeAnnouncementUrl(value), "Use a relative site link or an HTTPS URL."),
  icon: z.string().trim().max(8).optional().default(""),
  startAt: z.string().datetime({ offset: true }).nullable().optional(),
  endAt: z.string().datetime({ offset: true }).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.startAt && value.endAt && Date.parse(value.startAt) >= Date.parse(value.endAt)) {
    ctx.addIssue({ code: "custom", path: ["endAt"], message: "End time must be after start time." });
  }
});
export const announcementConfigSchema = z.object({
  enabled: z.boolean(),
  messages: z.array(announcementMessageSchema).min(1).max(8),
  speedSeconds: z.number().int().min(12).max(90),
  direction: z.enum(["left", "right"]),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  timezone: z.enum(["UTC", "Asia/Kolkata"]),
}).superRefine((value, ctx) => {
  const ids = value.messages.map((message) => message.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["messages"], message: "Each message must have a unique ID." });
});

export type AnnouncementMessage = z.infer<typeof announcementMessageSchema>;
export type AnnouncementConfig = z.infer<typeof announcementConfigSchema>;

export const defaultAnnouncement: AnnouncementConfig = {
  enabled: true,
  messages: [{ id: "default-news", text: "New resources added daily", url: "/shop", icon: "📚", startAt: null, endAt: null }],
  speedSeconds: 28,
  direction: "left",
  backgroundColor: "#123B63",
  textColor: "#FFFFFF",
  timezone: "UTC",
};

export function safeAnnouncementUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\\\")) return true;
  try { const url = new URL(value); return url.protocol === "https:"; } catch { return false; }
}

function fromRow(row: Record<string, unknown>): AnnouncementConfig {
  const parsed = announcementConfigSchema.safeParse({
    enabled: row.enabled,
    messages: row.messages,
    speedSeconds: row.speed_seconds,
    direction: row.direction,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    timezone: row.timezone,
  });
  return parsed.success ? parsed.data : defaultAnnouncement;
}

export const announcementQuery = () => queryOptions({
  queryKey: ["announcement-bar"],
  staleTime: 15_000,
  queryFn: async (): Promise<AnnouncementConfig> => {
    const { data, error } = await supabase.from("announcement_bar_config").select("*").eq("id", true).maybeSingle();
    if (error || !data) return defaultAnnouncement;
    return fromRow(data as unknown as Record<string, unknown>);
  },
});

export function useAnnouncementConfig() {
  return useQuery(announcementQuery());
}

export async function saveAnnouncementConfig(config: AnnouncementConfig) {
  const parsed = announcementConfigSchema.safeParse(config);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid announcement settings.");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Could not verify your admin session: ${sessionError.message}`);
  if (!sessionData.session) throw new Error("Your admin session has expired. Sign in again, then save your announcement settings.");

  const value = parsed.data;
  const { error } = await supabase.from("announcement_bar_config").upsert({
    id: true,
    enabled: value.enabled,
    messages: value.messages.map((message) => ({
      ...message,
      icon: /^[⭐🌟✦✧★☆]+$/u.test((message.icon ?? "").trim()) ? "" : (message.icon ?? ""),
    })),
    speed_seconds: value.speedSeconds,
    direction: value.direction,
    background_color: value.backgroundColor,
    text_color: value.textColor,
    timezone: value.timezone,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new Error("The announcement settings table is missing from Supabase. Apply the announcement/cookie consent migration, then try again.");
    }
    if (error.code === "42501" || error.code === "PGRST301") {
      throw new Error("Supabase denied this save. Confirm this account has the admin role and that the announcement admin-write RLS policy is applied.");
    }
    throw new Error(`Supabase could not save announcement settings (${error.code ?? "unknown error"}): ${error.message}`);
  }
}
