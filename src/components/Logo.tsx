import { useSiteSettings } from "@/lib/settings";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const { brandName } = useSiteSettings();
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={`${brandName} logo`} className={`${className} transition-transform duration-200 group-hover:scale-[1.03]`}>
      <rect x="1" y="6" width="30" height="21" rx="3" className="fill-primary" />
      <path
        d="M16 10.5c-2-1.4-4.4-1.9-6.8-1.5v10c2.4-.4 4.8.1 6.8 1.5 2-1.4 4.4-1.9 6.8-1.5V9c-2.4-.4-4.8.1-6.8 1.5Z"
        className="fill-primary-foreground"
      />
      <path d="M16 10.5v10" strokeWidth="1.2" className="stroke-primary" />
      <rect x="20" y="15" width="11" height="6" rx="2" className="fill-accent" />
      <circle cx="25" cy="18" r="1.4" className="fill-accent-foreground" />
    </svg>
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
          <span className="mt-0.5 text-[11px] text-muted-foreground">{tagline}</span>
        )}
      </span>
    </span>
  );
}
