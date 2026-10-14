import { useState } from "react";

export function LogoMark({ className = "h-10 w-24" }: { className?: string }) {
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable) {
    return <span className="text-sm font-semibold text-foreground">Revivor CS Test Series</span>;
  }
  return (
    <img
      src="/revivor-cs-test-series-logo.jpg"
      alt="Revivor CS Test Series logo"
      onError={() => setUnavailable(true)}
      className={`${className} shrink-0 object-contain`}
    />
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center">
      <LogoMark className={compact ? "h-10 w-24" : "h-16 w-32"} />
    </span>
  );
}
