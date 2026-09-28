import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const KEY = "edu-wallet-cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try { setVisible(localStorage.getItem(KEY) !== "accepted"); } catch { setVisible(false); }
  }, []);

  if (!visible) return null;

  const accept = () => {
    try { localStorage.setItem(KEY, "accepted"); } catch {}
    setVisible(false);
  };

  return (
    <aside
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-border bg-card p-4 shadow-xl sm:inset-x-6 sm:bottom-6 sm:flex sm:items-center sm:gap-4"
    >
      <p className="text-sm leading-6 text-muted-foreground">
        EduWallet uses essential browser storage and, when enabled, analytics cookies to improve the site. See our{" "}
        <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
      </p>
      <Button onClick={accept} className="mt-3 shrink-0 sm:mt-0">Accept</Button>
    </aside>
  );
}
