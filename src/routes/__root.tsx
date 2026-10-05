import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { defaultSettings, settingsQuery, useSiteSettings } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { CookieConsent } from "@/components/CookieConsent";

const RECOVERY_FLAG = "edu-wallet-password-recovery";

function NotFoundComponent() {
  return <div className="flex min-h-[60vh] items-center justify-center px-4"><div className="max-w-md text-center"><h1 className="font-serif text-6xl font-bold text-foreground">404</h1><h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2><p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p><div className="mt-6"><Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Go home</Link></div></div></div>;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { console.error(error); }, [error]);
  const retry = async () => {
    try { reset(); await router.invalidate(); } catch { window.location.reload(); }
  };
  const goHome = async () => {
    try { reset(); await router.navigate({ to: "/" }); } catch { window.location.assign("/"); }
  };
  return <div className="flex min-h-[60vh] items-center justify-center px-4"><div className="max-w-md text-center"><h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1><p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. Please try again or head back home.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => void retry()} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Try again</button><a href="/" onClick={(e) => { e.preventDefault(); void goHome(); }} className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/10">Go home</a></div></div></div>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async ({ context }) => { try { return await context.queryClient.ensureQueryData(settingsQuery()); } catch { return defaultSettings; } },
  head: ({ loaderData }) => {
    const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\\/$/, "");
    const ogImage = loaderData?.ogImageUrl || (publicSiteUrl ? `${publicSiteUrl}/og-image.svg` : "");
    const canonical = publicSiteUrl ? `${publicSiteUrl}/` : "";
    return {
      meta: [
        { charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: loaderData?.seoTitle || loaderData?.brandName || defaultSettings.brandName },
        { name: "description", content: loaderData?.seoDescription || "" },
        { property: "og:site_name", content: loaderData?.brandName || "" },
        { property: "og:type", content: "website" },
        ...(ogImage ? [{ property: "og:image", content: ogImage }] : []),
        ...(canonical ? [{ property: "og:url", content: canonical }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: loaderData?.seoTitle || loaderData?.brandName || "" },
        { name: "twitter:description", content: loaderData?.seoDescription || "" },
        ...(ogImage ? [{ name: "twitter:image", content: ogImage }] : []),
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&display=swap" },
        ...(loaderData?.faviconUrl ? [{ rel: "icon", href: loaderData.faviconUrl }] : []),
        ...(canonical ? [{ rel: "canonical", href: canonical }] : []),
      ],
    };
  },
  shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent,
});

function Analytics() {
  useEffect(() => {
    const id = siteConfig.analyticsMeasurementId;
    if (!id || document.querySelector('script[data-edu-analytics]')) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    script.dataset["eduAnalytics"] = "true";
    document.head.appendChild(script);
    const init = document.createElement("script");
    init.dataset["eduAnalytics"] = "true";
    init.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
    document.head.appendChild(init);
  }, []);
  return null;
}

function RootShell({ children }: { children: ReactNode }) {
  return <html lang="en"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}

function BrandTitleSync() {
  const { brandName, tagline } = useSiteSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const fb = siteConfig.fallbackBrand;
    let t = document.title;
    if (tagline && fb.tagline !== tagline) t = t.split(fb.tagline).join(tagline);
    if (brandName && fb.brandName !== brandName) t = t.split(fb.brandName).join(brandName);
    if (t !== document.title) document.title = t;
  }, [brandName, tagline, pathname]);
  return null;
}

function RecoveryRedirectHandler() {
  useEffect(() => {
    let active = true;
    const handleRecovery = () => {
      if (!active || window.location.pathname === "/reset-password") return;
      window.sessionStorage.setItem(RECOVERY_FLAG, "1");
      window.location.replace("/reset-password");
    };
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") handleRecovery(); });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const initialSettings = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthPage = pathname === "/login";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const key = settingsQuery().queryKey;
  if (initialSettings && !queryClient.getQueryData(key)) queryClient.setQueryData(key, initialSettings, { updatedAt: Date.now() });

  return <QueryClientProvider client={queryClient}>
    <RecoveryRedirectHandler />
    <BrandTitleSync />
    <Analytics />
    <div className={isAdminRoute ? "min-h-screen" : isAuthPage ? "min-h-screen" : "flex min-h-screen flex-col"}>
      {!isAuthPage && !isAdminRoute && <SiteHeader />}
      <main className={isAdminRoute || isAuthPage ? "min-h-screen" : "flex-1"}><Outlet /></main>
      {!isAuthPage && !isAdminRoute && <SiteFooter />}
    </div>
    <Toaster position="top-center" />
    {!isAdminRoute && <CookieConsent />}
  </QueryClientProvider>;
}
