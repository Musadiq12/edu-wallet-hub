import type { ReactNode } from "react";

type DarkGradientBgProps = {
  children: ReactNode;
  className?: string;
};

export function DarkGradientBg({ children, className = "" }: DarkGradientBgProps) {
  return (
    <div className={`relative isolate min-h-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.30),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(124,58,237,0.22),transparent_32%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:32px_32px]"
      />
      {children}
    </div>
  );
}
