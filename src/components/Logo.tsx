import { useState } from "react";

export function LogoMark({ className = "h-10 w-24" }: { className?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`${className} relative inline-flex shrink-0 items-center`}>
      {!loaded && <span className="text-xs font-semibold text-foreground">Revivor CS Test Series</span>}
    <img
      src="/revivor-cs-test-series-logo.jpg"
      alt="Revivor CS Test Series logo"
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(false)}
      className={`${className} absolute inset-0 shrink-0 object-contain ${loaded ? "" : "hidden"}`}
    />
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center">
      <LogoMark className={compact ? "h-10 w-24" : "h-16 w-32"} />
    </span>
  );
}
