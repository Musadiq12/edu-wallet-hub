"use client";

import { cn } from "@/lib/utils";
import type { HTMLProps, ReactNode } from "react";

interface AuroraBackgroundProps extends HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export function AuroraBackground({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  return (
    <main>
      <div
        className={cn(
          "relative flex h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 text-slate-950 transition-colors dark:bg-zinc-900",
          className,
        )}
        {...props}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={cn(
              "absolute -inset-[10px] animate-aurora bg-[length:300%_200%,_200%_200%] opacity-50 blur-[10px] invert will-change-transform dark:invert-0",
              `[--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)] [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)] [--aurora:repeating-linear-gradient(100deg,var(--blue-500)_10%,var(--indigo-300)_15%,var(--blue-300)_20%,var(--violet-200)_25%,var(--blue-400)_30%)]`,
              "[background-image:var(--white-gradient),var(--aurora)] [background-position:50%_50%,50%_50%]",
              "after:absolute after:inset-0 after:animate-aurora after:bg-[length:200%_100%] after:[background-image:var(--white-gradient),var(--aurora)] after:[background-attachment:fixed] after:mix-blend-difference after:content-['']",
              "dark:[background-image:var(--dark-gradient),var(--aurora)] dark:after:[background-image:var(--dark-gradient),var(--aurora)]",
              showRadialGradient &&
                "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]",
            )}
          />
        </div>
        <div className="relative z-10">{children}</div>
      </div>
    </main>
  );
}
