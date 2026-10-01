import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronDown,
  FileText,
  Gift,
  Layers3,
  Menu,
  Search,
  Shield,
  Target,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useIsAdmin, useSession, signOutCleanly } from "@/lib/auth";

type MenuItem = { title: string; href: string; icon: typeof BookOpen };

const resourceLinks: MenuItem[] = [
  { title: "Notes", href: "/shop?category=notes", icon: BookOpen },
  { title: "Guess Papers", href: "/shop?category=guess-papers", icon: FileText },
  { title: "Exam Guides", href: "/shop?category=exam-guides", icon: Target },
  { title: "Free Resources", href: "/free-resources", icon: Gift },
];

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

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [term, setTerm] = useState("");
  const scrolled = useScroll(10);
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user?.id);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchOpen(false);
    setOpen(false);
    navigate({ to: "/shop", search: { q: term || undefined, category: undefined } });
  };

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl transition-shadow",
      scrolled && "shadow-sm",
    )}>
      <nav className="page-container flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-5">
          <Link to="/" aria-label="EduWallet home" className="rounded-md p-1"><Logo compact /></Link>
          <div className="hidden items-center gap-1 lg:flex">
            <Link to="/shop" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-accent">Shop</Link>
            <div className="relative">
              <button type="button" onClick={() => setResourcesOpen((value) => !value)} aria-expanded={resourcesOpen} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium hover:bg-accent">
                Resources <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
              {resourcesOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-xl">
                  {resourceLinks.map((item) => (
                    <Link key={item.title} to={item.href as "/"} onClick={() => setResourcesOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent">
                      <item.icon className="h-4 w-4 text-primary" aria-hidden="true" /><span className="text-sm font-medium">{item.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link to="/free-resources" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-accent">Free Resources</Link>
            <Link to="/about" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-accent">About</Link>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Search resources" onClick={() => setSearchOpen((value) => !value)}><Search className="h-5 w-5" /></Button>
          {user ? (
            <>
              <Button variant="ghost" size="sm" className="hidden min-h-11 sm:inline-flex" asChild><Link to="/library">My Library</Link></Button>
              <div className="relative hidden sm:block">
                <button type="button" onClick={() => setAccountOpen((value) => !value)} aria-haspopup="menu" aria-expanded={accountOpen} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent">
                  <User className="mr-2 h-4 w-4" aria-hidden="true" /> Account
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-card p-2 shadow-xl" role="menu">
                    <Link to="/library" className="flex min-h-11 items-center gap-2 rounded-lg px-3 hover:bg-accent"><Layers3 className="h-4 w-4" aria-hidden="true" /> My Library</Link>
                    {isAdmin && <Link to="/admin" className="flex min-h-11 items-center gap-2 rounded-lg px-3 hover:bg-accent"><Shield className="h-4 w-4 text-primary" aria-hidden="true" /> Admin</Link>}
                    <button type="button" onClick={() => void signOutCleanly()} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-accent"><X className="h-4 w-4" aria-hidden="true" /> Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Button size="sm" className="hidden min-h-11 sm:inline-flex" asChild><Link to="/login">Sign in</Link></Button>
          )}
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-mobile-menu" onClick={() => setOpen((value) => !value)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      {searchOpen && (
        <div className="border-t border-border bg-background/95 backdrop-blur">
          <form onSubmit={submitSearch} className="page-container flex gap-2 py-3">
            <Input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search notes, exams, resources..." aria-label="Search resources" className="h-11" />
            <Button type="submit" className="h-11">Search</Button>
          </form>
        </div>
      )}

      {open && (
        <div id="site-mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 bg-background lg:hidden">
          <div className="page-container flex h-full flex-col gap-3 overflow-y-auto py-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <p className="font-serif text-xl font-semibold">Menu</p>
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}><X /></Button>
            </div>
            <Link to="/shop" onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-lg px-3 text-base font-semibold hover:bg-accent">Shop</Link>
            <Link to="/free-resources" onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-lg px-3 text-base font-semibold hover:bg-accent">Free Resources</Link>
            <Link to="/about" onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-lg px-3 text-base font-semibold hover:bg-accent">About</Link>
            <div className="border-t border-border pt-3">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Resources</p>
              {resourceLinks.map((item) => <Link key={item.title} to={item.href as "/"} onClick={() => setOpen(false)} className="mt-1 flex min-h-12 items-center gap-3 rounded-lg px-3 hover:bg-accent"><item.icon className="h-4 w-4 text-primary" aria-hidden="true" /><span className="text-sm font-medium">{item.title}</span></Link>)}
            </div>
            <div className="mt-auto border-t border-border pt-4">
              {user ? (
                <>
                  <Link to="/library" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-3 hover:bg-accent"><Layers3 className="h-4 w-4" aria-hidden="true" /> My Library</Link>
                  {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-3 hover:bg-accent"><Shield className="h-4 w-4" aria-hidden="true" /> Admin</Link>}
                  <Button variant="outline" className="mt-2 min-h-11 w-full" onClick={() => { setOpen(false); void signOutCleanly(); }}>Sign out</Button>
                </>
              ) : (
                <Button className="min-h-11 w-full" asChild><Link to="/login" onClick={() => setOpen(false)}>Sign in</Link></Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
