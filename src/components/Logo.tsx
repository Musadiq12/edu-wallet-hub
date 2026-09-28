import { useSiteSettings } from "@/lib/settings";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const { brandName } = useSiteSettings();
  return (
    <img
      src="/edu-wallet-icon.svg"
      alt={`${brandName} logo`}
      className={`${className} shrink-0 transition-transform duration-200 group-hover:scale-[1.03]`}
    />
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  const { brandName, tagline } = useSiteSettings();
  return (
    <span className="group flex items-center gap-2.5">
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-serif text-lg font-semibold tracking-tight text-foreground">
          {brandName}
        </span>
        {!compact && tagline && (
          <span className="mt-0.5 text-xs text-muted-foreground">{tagline}</span>
        )}
      </span>
    </span>
  );
}
