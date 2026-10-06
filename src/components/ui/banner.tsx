import { type HTMLAttributes, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerProps extends HTMLAttributes<HTMLDivElement> { message?: string; height?: string; }

export function Banner({ id, message, height = "2.5rem", className, ...props }: BannerProps) {
  const key = id ? `banner-${id}` : "";
  const [open, setOpen] = useState(true);
  useEffect(() => { if (key) setOpen(localStorage.getItem(key) !== "true"); }, [key]);
  if (!open) return null;
  return (
    <div id={id} style={{ minHeight: height }} className={cn("relative flex items-center justify-center border-b border-border bg-card px-12 py-2 text-center text-sm text-muted-foreground", className)} {...props}>
      <span>{message ?? props.children}</span>
      {id && <button type="button" aria-label="Close announcement" onClick={() => { setOpen(false); localStorage.setItem(key, "true"); }} className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4" aria-hidden="true" /></button>}
    </div>
  );
}
