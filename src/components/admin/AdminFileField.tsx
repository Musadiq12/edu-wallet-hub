import { useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { humanSize } from "@/lib/admin";

export type PickedFile = { file: File; previewUrl?: string | undefined };

type Props = {
  id: string;
  label: string;
  help?: string;
  accept: string;
  maxBytes: number;
  kind: "image" | "pdf";
  /** Path already stored in the database, if any. */
  existingPath?: string | null;
  picked: PickedFile | null;
  busy?: boolean;
  status?: string;
  onPick: (picked: PickedFile | null) => void;
  onRemoveExisting?: () => void;
};

export function AdminFileField({
  id,
  label,
  help,
  accept,
  maxBytes,
  kind,
  existingPath,
  picked,
  busy,
  status,
  onPick,
  onRemoveExisting,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const okType =
      kind === "pdf"
        ? file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        : file.type.startsWith("image/");
    if (!okType) {
      setError(kind === "pdf" ? "Only PDF files are allowed." : "Only image files are allowed.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`File is too large. Maximum size is ${humanSize(maxBytes)}.`);
      return;
    }
    setError(null);
    onPick({ file, previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined });
  };

  const Icon = kind === "pdf" ? FileText : ImageIcon;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input ref={inputRef} id={id} type="file" accept={accept} className="sr-only" onChange={handle} />

      <div className="rounded-lg border border-border bg-surface p-3">
        {picked ? (
          <div className="flex items-start gap-3">
            {picked.previewUrl ? (
              <img src={picked.previewUrl} alt="Selected cover preview" className="h-16 w-16 rounded-md object-cover" />
            ) : (
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{picked.file.name}</p>
              <p className="text-xs text-muted-foreground">{humanSize(picked.file.size)}</p>
              {status && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />} {status}
                </p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove selected file" disabled={busy} onClick={() => onPick(null)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : existingPath ? (
          <div className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{existingPath.split("/").pop()}</p>
              <p className="text-xs text-muted-foreground">Currently saved</p>
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
              {onRemoveExisting && (
                <Button type="button" variant="ghost" size="icon" aria-label="Remove saved file" disabled={busy} onClick={onRemoveExisting}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Choose file
          </Button>
        )}
      </div>

      {help && !error && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
