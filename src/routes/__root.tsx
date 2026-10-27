import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState,
  HeadContent, Scripts, type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config/site";
import { absoluteUrl, BRAND, buildMeta, buildTitle } from "@/lib/seo";
import { getBreadcrumbLd, getOrganizationLd, getWebsiteLd } from "@/lib/structured-data";
import { defaultSettings, settingsQuery, useSiteSettings } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { CookieConsent } from "@/components/CookieConsent";
import { AnnouncementMarquee } from "@/components/AnnouncementMarquee";

const RECOVERY_FLAG = "edu-wallet-password-recovery";

function NotFoundComponent() {
  return <div className="flex min-h-[60vh] items-center justify-center px-4"><div className="max-w-md text-center"><h1 className="font-serif text-6xl font-bold text-foreground">404</h1><h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2><p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p><div className="mt-6"><Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Go home</Link></div></div></div>;
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return <div className="flex min-h-[60vh] items-center justify-center px-4"><div className="max-w-md text-center"><h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1><p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end. Please try again or head back home.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Try again</button><a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/10">Go home</a></div></div></div>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async ({ context }) => { try { return await context.queryClient.ensureQueryData(settingsQuery()); } catch { return defaultSettings; } },
  head: ({ matches }) => {
    const currentMatch = matches[matches.length - 1] as (typeof matches)[number] & { pathname?: string; loaderData?: { product?: { title?: string }; title?: string } };
    const routePath = currentMatch?.pathname || "/";
    const pageName = currentMatch?.loaderData?.product?.title || currentMatch?.loaderData?.title;
    const structuredData = [getOrganizationLd(), getWebsiteLd(), getBreadcrumbLd(routePath, pageName)].filter(Boolean);
    return ({
    meta: [
      { charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: buildTitle(["Study Resources", BRAND]) },
      { name: "description", content: buildMeta(siteConfig.shortDescription) },
      { property: "og:site_name", content: BRAND },
      { property: "og:type", content: "website" },
      { property: "og:image", content: absoluteUrl("/og-image.svg") },
      { property: "og:url", content: absoluteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: BRAND },
      { name: "twitter:description", content: buildMeta(siteConfig.shortDescription) },
      { name: "twitter:image", content: absoluteUrl("/og-image.svg") },
    ],
    scripts: structuredData.map((data) => ({ type: "application/ld+json", children: JSON.stringify(data).replace(/</g, "\\u003c") })),
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&display=swap" },
      { rel: "icon", href: absoluteUrl("/edu-wallet-icon.svg"), type: "image/svg+xml" },
    ],
  });
  },
  shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent,
});

function Analytics() {
  useEffect(() => {
    const loadAnalytics = () => {
      const consent = window.__eduWalletConsent;
      const id = siteConfig.analyticsMeasurementId;
      if (!consent?.analytics || !id || document.querySelector('script[data-edu-analytics]')) return;
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      script.dataset["eduAnalytics"] = "true";
      document.head.appendChild(script);
      const init = document.createElement("script");
      init.dataset["eduAnalyticsInit"] = "true";
      init.text = "window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());window.gtag('config','" + id + "',{anonymize_ip:true});";
      document.head.appendChild(init);
    };
    window.addEventListener("eduwallet:consent-changed", loadAnalytics);
    loadAnalytics();
    return () => window.removeEventListener("eduwallet:consent-changed", loadAnalytics);
  }, []);
  return null;
}
function RootShell({ children }: { children: ReactNode }) {
  return <html lang="en"><head><HeadContent /><script dangerouslySetInnerHTML={{ __html: "window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:'denied',personalization_storage:'denied',security_storage:'granted',wait_for_update:500});" }} /></head><body>{children}<Scripts /></body></html>;
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
    <Analytics />
    <div className={isAdminRoute ? "min-h-screen" : isAuthPage ? "min-h-screen" : "flex min-h-screen flex-col"}>
      {!isAuthPage && !isAdminRoute && <SiteHeader />}
      {!isAuthPage && !isAdminRoute && <AnnouncementMarquee />}
      <main className={isAdminRoute || isAuthPage ? "min-h-screen" : "flex-1"}><Outlet /></main>
      {!isAuthPage && !isAdminRoute && <SiteFooter />}
    </div>
    <Toaster position="top-center" />
    {!isAdminRoute && <CookieConsent />}
  </QueryClientProvider>;
}
