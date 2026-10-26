import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3, BookOpen, FileText, Gift, Globe2, HelpCircle, Layers3,
  Menu, RotateCcw, Search, Shield, Target, UserPlus, Users, X, ChevronRight,
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
  const [term, setTerm] = useState("");
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
    setOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchOpen(false);
    setOpen(false);
    navigate({ to: "/shop", search: { q: term || undefined, category: undefined } });
  };

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
          <Button variant="outline" size="icon" className="lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-mobile-menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
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

      {open && (
        <div id="site-mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-border bg-background lg:hidden">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-8 pt-5 sm:px-6">
            <section aria-labelledby="mobile-account-heading" className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p id="mobile-account-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your account</p>
                  <p className="mt-1 text-sm text-muted-foreground">{user ? "Quick access to your account" : "Sign in to keep your resources together"}</p>
                </div>
              </div>
              {user ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild><Link to="/library" onClick={() => setOpen(false)}><Layers3 className="mr-2 size-4" />My Library</Link></Button>
                  {isAdmin && <Button variant="outline" size="sm" asChild><Link to="/admin" onClick={() => setOpen(false)}><Shield className="mr-2 size-4" />Admin</Link></Button>}
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" type="button" onClick={() => { setOpen(false); void signOutCleanly(); }}>Logout</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" asChild><Link to="/login" onClick={() => setOpen(false)}>Log in</Link></Button>
                  <Button className="flex-1" asChild><Link to="/register" onClick={() => setOpen(false)}>Create account</Link></Button>
                </div>
              )}
            </section>

            <section aria-label="Main links" className="grid grid-cols-2 gap-2">
              <Link to="/shop" onClick={() => setOpen(false)} className="col-span-2 flex min-h-14 items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground transition-colors hover:bg-primary/90">
                <span className="flex items-center gap-3 font-semibold"><BookOpen className="size-5" />Browse the shop</span><ChevronRight className="size-5" />
              </Link>
              <Link to="/free-resources" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-accent">
                <Gift className="size-4 shrink-0 text-muted-foreground" />Free resources
              </Link>
              <Link to="/blog" onClick={() => setOpen(false)} aria-current={isBlogActive ? "page" : undefined} className={cn("flex min-h-12 items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-accent", isBlogActive && "border-primary/30 bg-accent")}>
                <BookOpen className="size-4 shrink-0 text-muted-foreground" />Blog
              </Link>
            </section>

            <MobileSection title="Explore resources" items={productLinks.filter((item) => item.title !== "Free Resources")} onNavigate={() => setOpen(false)} />
            <MobileSection title="About EduWallet" items={[...companyLinks, ...companyLinks2]} onNavigate={() => setOpen(false)} compact />
            <p className="border-t border-border pt-4 text-xs text-muted-foreground">Study resources for your next step.</p>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileSection({ title, items, onNavigate, compact = false }: { title: string; items: LinkItem[]; onNavigate: () => void; compact?: boolean }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className={compact ? "divide-y divide-border rounded-lg border border-border" : "grid grid-cols-2 gap-2"}>
        {items.map((item) => (
          <Link key={item.title} to={item.href as "/"} onClick={onNavigate} className={cn(
            "group flex min-w-0 items-center gap-3 transition-colors hover:bg-accent",
            compact ? "px-3 py-3" : "rounded-lg border border-border px-3 py-3",
          )}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"><item.icon className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-5">{item.title}</span>
              {!compact && item.description && <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-muted-foreground">{item.description}</span>}
            </span>
            {compact && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          </Link>
        ))}
      </div>
    </section>
  );
}
