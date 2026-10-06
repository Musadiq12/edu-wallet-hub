import type { ReactNode } from "react";

type DarkGradientBgProps = {
  children: ReactNode;
  className?: string;
};

export function DarkGradientBg({ children, className = "" }: DarkGradientBgProps) {
  return (
    <div className={`relative isolate min-h-full overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(124,58,237,0.10),transparent_30%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:32px_32px]"
      />
      {children}
    </div>
  );
}
