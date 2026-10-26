import { useSiteSettings } from "@/lib/settings";

export function LogoMark({ className = "h-10 w-24" }: { className?: string }) {
  const { brandName } = useSiteSettings();

  return (
    <span className={`${className} inline-flex shrink-0 items-center gap-2`}>
      <img
        src="/edu-wallet-icon.svg"
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0 object-contain"
      />
      <span className="min-w-0 truncate text-sm font-bold tracking-tight text-foreground">
        {brandName || "EduWallet"}
      </span>
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  const { brandName, tagline } = useSiteSettings();

  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <img
        src="/edu-wallet-icon.svg"
        alt=""
        aria-hidden="true"
        className={compact ? "h-9 w-9 shrink-0 object-contain" : "h-12 w-12 shrink-0 object-contain"}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-base font-bold tracking-tight text-foreground">
          {brandName || "EduWallet"}
        </span>
        {!compact && tagline && (
          <span className="line-clamp-2 text-xs text-muted-foreground">{tagline}</span>
        )}
      </span>
    </span>
  );
}
