import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/admin";
import { SETTING_FIELDS, defaultSettings, saveSettings, settingsQuery, type SiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(settingsQuery());
  const [values, setValues] = useState<SiteSettings>(defaultSettings);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.contactEmail && !/^\S+@\S+\.\S+$/.test(values.contactEmail)) {
      return void toast.error("Enter a valid contact email address.");
    }
    setBusy(true);
    try {
      await saveSettings(values);
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not save the settings."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These values are used across the website — brand name, contact details, UPI payment details and social links.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
      ) : (
        <form onSubmit={submit} className="max-w-2xl space-y-4">
          {SETTING_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                className="h-11"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            </div>
          ))}
          <Button type="submit" className="h-11" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
        </form>
      )}
    </div>
  );
}
