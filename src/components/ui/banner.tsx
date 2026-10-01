import { type HTMLAttributes, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  message?: string;
  height?: string;
}

export function Banner({ id, message, height = "2.25rem", ...props }: BannerProps): React.ReactElement {
  const [open, setOpen] = useState(true);
  const storageKey = id ? `banner-dismissed-${id}` : undefined;

  useEffect(() => {
    if (storageKey) setOpen(localStorage.getItem(storageKey) !== "true");
  }, [storageKey]);

  if (!open) return <div id={id} className="hidden" aria-hidden="true" />;

  return (
    <div
      id={id}
      {...props}
      style={{ minHeight: height }}
      className={cn("relative z-40 flex items-center justify-center border-b border-border bg-primary px-10 text-center text-xs font-semibold text-primary-foreground", props.className)}
    >
      <span>{message || props.children}</span>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          setOpen(false);
          if (storageKey) localStorage.setItem(storageKey, "true");
        }}
        className="absolute right-2 inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-primary-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
