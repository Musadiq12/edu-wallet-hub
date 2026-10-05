import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/lib/settings";
import { useSession } from "@/lib/auth";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const scrolled = useScroll(10);
  const { user } = useSession();
  const { brandName } = useSiteSettings();

  return (
    <header className={cn("sticky top-0 z-50 w-full border-b border-transparent transition-all", scrolled && "border-slate-200/80 bg-[#f8f6f0]/95 shadow-sm backdrop-blur-xl")}>
      <nav className="page-container flex h-[72px] items-center justify-between gap-4">
        <Link to="/" aria-label={brandName + " home"} className="shrink-0 rounded-xl px-1 py-1 hover:bg-slate-900/5"><Logo compact /></Link>
        <div className="hidden items-center gap-7 lg:flex">
          <a href="#finder" className="text-sm font-semibold text-slate-700 hover:text-slate-950">Find My Plan</a>
          <a href="#series" className="text-sm font-semibold text-slate-700 hover:text-slate-950">Test Series</a>
          <a href="#details" className="text-sm font-semibold text-slate-700 hover:text-slate-950">How It Works</a>
          <a href="#sample" className="text-sm font-semibold text-slate-700 hover:text-slate-950">Free Sample</a>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/shop" aria-label="Shopping cart" className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:shadow-sm"><ShoppingBag className="size-4" /></Link>
          {user ? <Link to="/library" className="hidden rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex">My Library</Link> : <Link to="/login" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:shadow-sm sm:inline-flex">Login</Link>}
          <a href="#finder" className="hidden rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300 sm:inline-flex">Enroll Now</a>
          <button type="button" className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="revivor-mobile-menu" onClick={() => setOpen((v) => !v)}>{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </div>
      </nav>
      {open && <div id="revivor-mobile-menu" className="border-t border-slate-200 bg-[#f8f6f0] lg:hidden"><div className="page-container grid gap-2 py-4">{[["Find My Plan","#finder"],["Test Series","#series"],["How It Works","#details"],["Free Sample","#sample"]].map(([label,target]) => <a key={target} href={target} onClick={() => setOpen(false)} className="rounded-xl bg-white px-4 py-3 text-sm font-bold">{label}</a>)}<Link to="/login" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">Login</Link></div></div>}
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
      } catch { setCount(0); }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("revivor:cart", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("revivor:cart", read);
    };
  }, []);
  return <Link to="/shop" aria-label={count ? "Shopping cart with items" : "Shopping cart, empty"} className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white hover:shadow-sm"><ShoppingBag className="size-4" />{count > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950">{count}</span>}</Link>;
}
