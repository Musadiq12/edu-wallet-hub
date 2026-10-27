import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AnnouncementMarquee } from "@/components/AnnouncementMarquee";
import { announcementQuery, announcementConfigSchema, defaultAnnouncement, saveAnnouncementConfig, type AnnouncementConfig, type AnnouncementMessage } from "@/lib/announcement";

export const Route = createFileRoute("/admin/announcements")({ component: AnnouncementSettings });

function newMessage(): AnnouncementMessage {
  return { id: crypto.randomUUID().replaceAll("-", "").slice(0, 18), text: "", url: "", icon: "", startAt: null, endAt: null };
}
function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function AnnouncementSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(announcementQuery());
  const [config, setConfig] = useState<AnnouncementConfig>(defaultAnnouncement);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setConfig(data); }, [data]);

  const updateMessage = (index: number, patch: Partial<AnnouncementMessage>) => setConfig((current) => ({
    ...current,
    messages: current.messages.map((message, i) => i === index ? { ...message, ...patch } : message),
  }));
  const moveMessage = (index: number, offset: number) => setConfig((current) => {
    const messages = [...current.messages];
    const target = index + offset;
    if (target < 0 || target >= messages.length) return current;
    [messages[index], messages[target]] = [messages[target], messages[index]];
    return { ...current, messages };
  });
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = announcementConfigSchema.safeParse(config);
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Check the announcement settings.");
    setBusy(true);
    try {
      await saveAnnouncementConfig(parsed.data);
      await qc.invalidateQueries({ queryKey: ["announcement-bar"] });
      toast.success("Announcement bar saved. Public pages update without a redeploy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save announcement settings.");
    } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Announcement Bar</h1><p className="mt-1 text-sm text-muted-foreground">Configure the top-of-site announcements. Schedule times are stored as timestamps and displayed in the selected timezone.</p></div>
    <section className="space-y-2 rounded-xl border border-border p-4">
      <h2 className="font-semibold">Live preview</h2>
      <AnnouncementMarquee preview config={config} />
      <p className="text-xs text-muted-foreground">The preview uses the same marquee component and styles as the public site.</p>
    </section>
    {isLoading ? <p className="text-sm text-muted-foreground">Loading announcement settings…</p> : <form onSubmit={save} className="space-y-6">
      <section className="flex items-center justify-between rounded-xl border border-border p-4">
        <div><Label htmlFor="announcement-enabled" className="font-semibold">Enable announcement bar</Label><p className="mt-1 text-sm text-muted-foreground">The bar stays visible while enabled and within schedule.</p></div>
        <Switch id="announcement-enabled" checked={config.enabled} onCheckedChange={(enabled) => setConfig((current) => ({ ...current, enabled }))} />
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Messages</h2><p className="text-sm text-muted-foreground">Up to 8 messages; content is rendered as plain text, never HTML.</p></div><Button type="button" variant="outline" disabled={config.messages.length >= 8} onClick={() => setConfig((current) => ({ ...current, messages: [...current.messages, newMessage()] }))}><Plus className="mr-1 size-4" />Add message</Button></div>
        {config.messages.map((message, index) => <fieldset key={message.id} className="space-y-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Message {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <div className="space-y-1.5"><Label htmlFor={`announcement-text-${message.id}`}>Message text</Label><Input id={`announcement-text-${message.id}`} value={message.text} maxLength={160} required onChange={(e) => updateMessage(index, { text: e.target.value })} placeholder="New resources added daily" /></div>
            <div className="space-y-1.5"><Label htmlFor={`announcement-icon-${message.id}`}>Emoji / icon</Label><Input id={`announcement-icon-${message.id}`} value={message.icon ?? ""} maxLength={8} onChange={(e) => updateMessage(index, { icon: e.target.value })} placeholder="📚" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor={`announcement-url-${message.id}`}>Link URL (optional)</Label><Input id={`announcement-url-${message.id}`} value={message.url} maxLength={500} onChange={(e) => updateMessage(index, { url: e.target.value })} placeholder="/shop or https://example.com" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor={`announcement-start-${message.id}`}>Start time (optional)</Label><Input id={`announcement-start-${message.id}`} type="datetime-local" value={toLocalInput(message.startAt)} onChange={(e) => updateMessage(index, { startAt: fromLocalInput(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor={`announcement-end-${message.id}`}>End time (optional)</Label><Input id={`announcement-end-${message.id}`} type="datetime-local" value={toLocalInput(message.endAt)} onChange={(e) => updateMessage(index, { endAt: fromLocalInput(e.target.value) })} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveMessage(index, -1)} aria-label={`Move message ${index + 1} up`}><ArrowUp className="mr-1 size-4" />Move up</Button>
            <Button type="button" variant="outline" size="sm" disabled={index === config.messages.length - 1} onClick={() => moveMessage(index, 1)} aria-label={`Move message ${index + 1} down`}><ArrowDown className="mr-1 size-4" />Move down</Button>
            <Button type="button" variant="destructive" size="sm" disabled={config.messages.length <= 1} onClick={() => setConfig((current) => ({ ...current, messages: current.messages.filter((item) => item.id !== message.id) }))}><Trash2 className="mr-1 size-4" />Delete</Button>
          </div>
        </fieldset>)}
      </section>

      <section className="grid gap-5 rounded-xl border border-border p-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="announcement-speed">Scroll speed: {config.speedSeconds}s per loop</Label><input id="announcement-speed" className="w-full accent-primary" type="range" min="12" max="90" step="1" value={config.speedSeconds} onChange={(e) => setConfig((current) => ({ ...current, speedSeconds: Number(e.target.value) }))} /><div className="flex justify-between text-xs text-muted-foreground"><span>Faster (12s)</span><span>Slower (90s)</span></div></div>
        <div className="space-y-2"><Label htmlFor="announcement-direction">Direction</Label><select id="announcement-direction" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={config.direction} onChange={(e) => setConfig((current) => ({ ...current, direction: e.target.value as "left" | "right" }))}><option value="left">Move left</option><option value="right">Move right</option></select></div>
        <div className="space-y-2"><Label htmlFor="announcement-background">Background color</Label><div className="flex gap-2"><input id="announcement-background" aria-label="Choose background color" type="color" value={config.backgroundColor} onChange={(e) => setConfig((current) => ({ ...current, backgroundColor: e.target.value }))} className="h-10 w-12 rounded border border-input bg-background p-1" /><Input aria-label="Background hex color" value={config.backgroundColor} onChange={(e) => setConfig((current) => ({ ...current, backgroundColor: e.target.value }))} pattern="^#[0-9a-fA-F]{6}$" required /></div></div>
        <div className="space-y-2"><Label htmlFor="announcement-text-color">Text color</Label><div className="flex gap-2"><input id="announcement-text-color" aria-label="Choose text color" type="color" value={config.textColor} onChange={(e) => setConfig((current) => ({ ...current, textColor: e.target.value }))} className="h-10 w-12 rounded border border-input bg-background p-1" /><Input aria-label="Text hex color" value={config.textColor} onChange={(e) => setConfig((current) => ({ ...current, textColor: e.target.value }))} pattern="^#[0-9a-fA-F]{6}$" required /></div><p className="text-xs text-muted-foreground">Choose a high-contrast combination. Verify text contrast before publishing.</p></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="announcement-timezone">Scheduling timezone</Label><select id="announcement-timezone" className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm" value={config.timezone} onChange={(e) => setConfig((current) => ({ ...current, timezone: e.target.value as "UTC" | "Asia/Kolkata" }))}><option value="UTC">UTC</option><option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option></select><p className="text-xs text-muted-foreground">Browser inputs use your device timezone; saved timestamps are UTC. Pick a timezone and enter dates with your device set to that timezone for accurate scheduling.</p></div>
      </section>
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save announcement settings"}</Button>
    </form>}
  </div>;
}
