import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3, BookOpen, FileText, Gift, Globe2, HelpCircle, Layers3,
  Menu, RotateCcw, Search, Shield, Target, UserPlus, Users, X, ChevronRight, ChevronDown, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useSiteSettings } from "@/lib/settings";
import { useIsAdmin, useSession, signOutCleanly } from "@/lib/auth";

type LinkItem = { title: string; href: string; icon: typeof Globe2; description?: string };

const productLinks: LinkItem[] = [
  { title: "Study Notes", href: "/shop?category=notes", description: "Subject-wise notes and revision material", icon: BookOpen },
  { title: "Guess Papers", href: "/shop?category=guess-papers", description: "Exam-oriented practice and likely-topic guides", icon: FileText },
  { title: "Exam Guides", href: "/shop?category=exam-guides", description: "Focused preparation and revision resources", icon: Target },
  { title: "Free Resources", href: "/free-resources", description: "Free samples and study material", icon: Gift },
  { title: "Popular Exams", href: "/shop", description: "Resources across competitive exams", icon: BarChart3 },
  { title: "Student Library", href: "/library", description: "Access resources you have purchased", icon: Layers3 },
];

const companyLinks: LinkItem[] = [
  { title: "About Us", href: "/about", description: "Learn more about EduWallet", icon: Users },
  { title: "Contact", href: "/contact", description: "Get in touch for support or questions", icon: UserPlus },
  { title: "Terms", href: "/terms", description: "Terms governing use of the platform", icon: FileText },
];

const companyLinks2: LinkItem[] = [
  { title: "Privacy Policy", href: "/privacy", icon: Shield },
  { title: "Refund Policy", href: "/terms", icon: RotateCcw },
  { title: "Help Center", href: "/contact", icon: HelpCircle },
];

function ListItem({ title, description, icon: Icon, href }: LinkItem) {
  return (
    <NavigationMenuLink asChild>
      <Link to={href as "/"} className="flex w-full flex-row items-center gap-x-3 rounded-md p-2 transition-colors hover:bg-accent hover:text-accent-foreground">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-background shadow-sm"><Icon className="size-5" /></div>
        <div className="flex min-w-0 flex-col items-start justify-center">
          <span className="font-medium">{title}</span>
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
        </div>
      </Link>
    </NavigationMenuLink>
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

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [term, setTerm] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const scrolled = useScroll(10);
  const navigate = useNavigate();
  const location = useLocation();
  const isBlogActive = location.pathname === "/blog" || location.pathname.startsWith("/blog/");
  const { user } = useSession();
  const { brandName } = useSiteSettings();
  const { data: isAdmin } = useIsAdmin(user?.id);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
    else if (wasOpen.current) menuButtonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
    setExploreOpen(false);
  }, [location.pathname]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchOpen(false);
    setOpen(false);
    navigate({ to: "/shop", search: { q: term || undefined, category: undefined } });
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeMenu = () => setOpen(false);

  return (
    <header className={cn("sticky top-0 z-50 w-full border-b border-transparent transition-colors", scrolled && "border-border bg-background/95 shadow-sm backdrop-blur-lg supports-[backdrop-filter]:bg-background/70")}>
      <nav className="page-container flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" aria-label={brandName + " home"} className="shrink-0 rounded-md p-1 hover:bg-accent/10"><Logo compact /></Link>
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent">Resources</NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background p-1">
                  <div className="grid w-[720px] grid-cols-2 gap-2 rounded-md border bg-popover p-2 shadow-lg">{productLinks.map((item) => <ListItem key={item.title} {...item} />)}</div>
                  <div className="px-3 pb-2 pt-2 text-sm text-muted-foreground">Looking for something specific?{" "}<Link to="/shop" className="font-medium text-foreground hover:underline">Browse all resources</Link></div>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent">Company</NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background p-1">
                  <div className="grid w-[720px] grid-cols-2 gap-2">
                    <ul className="space-y-2 rounded-md border bg-popover p-2 shadow-lg">{companyLinks.map((item) => <li key={item.title}><ListItem {...item} /></li>)}</ul>
                    <ul className="space-y-2 p-3">{companyLinks2.map((item) => <li key={item.title}><NavigationMenuLink asChild><Link to={item.href as "/"} className="flex items-center gap-x-2 rounded-md p-2 hover:bg-accent"><item.icon className="size-4" /><span className="font-medium">{item.title}</span></Link></NavigationMenuLink></li>)}</ul>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuLink asChild><Link to="/shop" className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent">Shop</Link></NavigationMenuLink>
              <NavigationMenuLink asChild><Link to="/free-resources" className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent">Free Resources</Link></NavigationMenuLink>
              <NavigationMenuLink asChild><Link to="/blog" aria-current={isBlogActive ? "page" : undefined} className={cn("rounded-md px-4 py-2 text-sm font-medium hover:bg-accent", isBlogActive && "bg-accent text-accent-foreground")}>Blog</Link></NavigationMenuLink>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Search resources" onClick={() => { setSearchOpen((v) => !v); setOpen(false); }}><Search className="size-5" /></Button>
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <>
                <Button variant="ghost" size="sm" asChild><Link to="/library">My Library</Link></Button>
                {isAdmin && <Button variant="ghost" size="sm" asChild><Link to="/admin">Admin</Link></Button>}
                <Button variant="outline" size="sm" onClick={() => void signOutCleanly()}>Logout</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild><Link to="/login">Login</Link></Button>
                <Button size="sm" asChild><Link to="/register">Register</Link></Button>
              </>
            )}
          </div>
          <Button ref={menuButtonRef} variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu" aria-expanded={open} aria-controls="site-mobile-menu" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </Button>
        </div>
      </nav>

      {searchOpen && (
        <div className="border-t border-border bg-background/95 backdrop-blur">
          <form onSubmit={submitSearch} className="page-container flex gap-2 py-3">
            <Input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search notes, exams, resources..." aria-label="Search resources" className="h-10" />
            <Button type="submit" className="h-10">Search</Button>
          </form>
        </div>
      )}

      <div
        id="site-mobile-menu"
        className={cn("fixed inset-0 z-[60] bg-background transition-opacity duration-200 ease-out motion-reduce:transition-none lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        aria-hidden={!open}
        inert={!open}
        onKeyDown={handleMenuKeyDown}
      >
        <div className={cn("flex h-[100dvh] flex-col transition-transform duration-200 ease-out motion-reduce:transition-none", open ? "translate-x-0" : "translate-x-full")}>
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
            <Link to="/" aria-label={brandName + " home"} onClick={closeMenu} className="rounded-md p-1"><Logo compact /></Link>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Search resources" className="size-11" onClick={() => { setOpen(false); setSearchOpen(true); }}><Search className="size-5" /></Button>
              <Button ref={closeButtonRef} variant="ghost" size="icon" aria-label="Close navigation menu" className="size-11" onClick={closeMenu}><X className="size-5" /></Button>
            </div>
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:px-6">
            <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
              <Link
                to={user ? "/library" : "/login"}
                onClick={closeMenu}
                className="flex min-h-[84px] items-center gap-4 rounded-md bg-emerald-800 px-4 py-4 text-white transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
              >
                <Layers3 aria-hidden="true" className="size-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold leading-6">My Library</span>
                  <span className="mt-1 block text-sm text-emerald-50">{user ? "Your purchased resources" : "Sign in to access your resources"}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
              </Link>

              <Link
                to="/blog"
                onClick={closeMenu}
                aria-current={isBlogActive ? "page" : undefined}
                className={cn("flex min-h-14 items-center justify-between border-b border-border px-1 py-3 text-base font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", isBlogActive && "text-primary")}
              >
                <span className="flex items-center gap-3"><BookOpen aria-hidden="true" className="size-5" />Blog & study advice</span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
              </Link>

              <Link
                to="/shop"
                onClick={closeMenu}
                className="flex min-h-12 items-center justify-between rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span>Browse the shop</span><ChevronRight aria-hidden="true" className="size-4" />
              </Link>

              <section className="border-t border-border pt-3" aria-labelledby="mobile-explore-heading">
                <button
                  id="mobile-explore-heading"
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-expanded={exploreOpen}
                  aria-controls="mobile-explore-links"
                  onClick={() => setExploreOpen((value) => !value)}
                >
                  <span className="uppercase tracking-wide">Explore resources</span>
                  <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform duration-200", exploreOpen && "rotate-180")} />
                </button>
                <div id="mobile-explore-links" hidden={!exploreOpen} className="grid grid-cols-2 gap-x-5 gap-y-0 border-t border-border pb-2 pt-1">
                  {productLinks.map((item) => (
                    <Link key={item.title} to={item.href as "/"} onClick={closeMenu} className="flex min-h-12 items-center border-b border-border/70 py-2 text-sm font-medium leading-5 text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      {item.title}
                    </Link>
                  ))}
                </div>
              </section>

              <section className="border-t border-border pt-3" aria-labelledby="mobile-company-heading">
                <h2 id="mobile-company-heading" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">About EduWallet</h2>
                <div className="grid grid-cols-2 gap-x-5">
                  {[...companyLinks, ...companyLinks2].map((item) => (
                    <Link key={item.title} to={item.href as "/"} onClick={closeMenu} className="flex min-h-11 items-center border-b border-border/70 py-2 text-sm text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      {item.title}
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </main>

          <footer className="shrink-0 border-t border-border bg-background px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-6">
            <div className="mx-auto flex w-full max-w-lg items-center gap-3">
              {user ? (
                <>
                  {isAdmin && <Link to="/admin" onClick={closeMenu} className="flex min-h-12 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Admin</Link>}
                  <Button variant="outline" className="ml-auto min-h-12 border-red-700 bg-transparent px-4 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950" onClick={() => { closeMenu(); void signOutCleanly(); }}>
                    <LogOut aria-hidden="true" className="mr-2 size-4" />Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="min-h-12 flex-1" asChild><Link to="/login" onClick={closeMenu}>Log in</Link></Button>
                  <Button className="min-h-12 flex-1" asChild><Link to="/register" onClick={closeMenu}>Create account</Link></Button>
                </>
              )}
            </div>
          </footer>
        </div>
      </div>
    </header>
  );
}
