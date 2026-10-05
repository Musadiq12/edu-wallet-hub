import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth";

const sectionLinks = [
  ["Find My Plan", "finder"],
  ["Test Series", "shop"],
  ["How It Works", "details"],
  ["Free Sample", "sample"],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const scrolled = useScroll(10);
  const { user } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const sectionHref = (target: string) => target === "shop" ? "/shop" : (pathname === "/" ? `#${target}` : `/#${target}`);

  return (
    <header className={cn(
      "sticky top-0 z-[100] w-full border-b border-transparent transition-all",
      scrolled && "border-slate-200/80 bg-[#f8f6f0]/95 shadow-sm backdrop-blur-xl",
    )}>
      <nav className="page-container flex h-[72px] items-center justify-between gap-4">
        <Link
          to="/"
          aria-label="Revivor CS Test Series home"
          className="shrink-0 rounded-xl px-1 py-1 hover:bg-slate-900/5"
        >
          <span className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-amber-400">R</span>
            <span className="hidden text-sm font-black tracking-tight text-slate-950 sm:inline">Revivor CS Test Series</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {sectionLinks.map(([label, hash]) => (
            <a key={hash} href={sectionHref(hash)} className="text-sm font-semibold text-slate-700 hover:text-slate-950">
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <CartLink />
          {user ? (
            <Link to="/dashboard" className="hidden rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex">
              My Library
            </Link>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:shadow-sm">Login</Link>
              <Link to="/register" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:shadow-sm">Register</Link>
            </div>
          )}
          <a href={sectionHref("finder")} className="hidden rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300 sm:inline-flex">
            Enroll Now
          </a>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="revivor-mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="revivor-mobile-menu" className="border-t border-slate-200 bg-[#f8f6f0] lg:hidden">
          <div className="page-container grid gap-2 py-4">
            {sectionLinks.map(([label, hash]) => (
              <a
                key={hash}
                href={sectionHref(hash)}
                onClick={() => setOpen(false)}
                className="rounded-xl bg-white px-4 py-3 text-sm font-bold"
              >
                {label}
              </a>
            ))}
            <Link to="/shop" onClick={() => setOpen(false)} className="rounded-xl bg-white px-4 py-3 text-sm font-bold">Test Series</Link>
            {user ? (
              <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Dashboard</Link>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">Login</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">Register</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function CartLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("revivor-cart");
        const parsed = raw ? JSON.parse(raw) : [];
        setCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch {
        setCount(0);
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("revivor:cart", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("revivor:cart", read);
    };
  }, []);

  return (
    <Link
      to="/shop"
      aria-label={count ? "Shopping cart with items" : "Shopping cart, empty"}
      className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:shadow-sm"
    >
      <ShoppingBag className="size-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950">
          {count}
        </span>
      )}
    </Link>
  );
}
