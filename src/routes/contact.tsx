import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Instagram, Mail, MessageCircle, Send, Youtube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { isEmail, safeUrl, useSiteSettings, waLink } from "@/lib/settings";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact" },
      { name: "description", content: "Get in touch with the Edu Wallet team by email, WhatsApp or the contact form." },
      { property: "og:title", content: "Contact" },
      { property: "og:description", content: "Questions about study resources or an order? Contact us." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const s = useSiteSettings();
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", message: "" });
  const [busy, setBusy] = useState(false);
  const wa = waLink(s.whatsappNumber, `Hello ${s.brandName}, I have a question.`);
  const links = [
    wa && { href: wa, label: "Chat on WhatsApp", Icon: MessageCircle },
    isEmail(s.contactEmail) && { href: `mailto:${s.contactEmail}`, label: s.contactEmail, Icon: Mail },
    safeUrl(s.instagram) && { href: safeUrl(s.instagram), label: "Instagram", Icon: Instagram },
    safeUrl(s.telegram) && { href: safeUrl(s.telegram), label: "Telegram", Icon: Send },
    safeUrl(s.youtube) && { href: safeUrl(s.youtube), label: "YouTube", Icon: Youtube },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Mail }[];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim(), email = form.email.trim(), message = form.message.trim();
    if (name.length < 2) return void toast.error("Please enter your name.");
    if (!isEmail(email)) return void toast.error("Please enter a valid email address.");
    if (message.length < 5 || message.length > 2000) return void toast.error("Please enter a message (5–2000 characters).");
    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: name.slice(0, 100), email: email.slice(0, 255), whatsapp: form.whatsapp.trim().slice(0, 20) || null, message,
    });
    setBusy(false);
    if (error) return void toast.error("Your message could not be sent. Please try again.");
    toast.success("Message sent. We'll get back to you soon.");
    setForm({ name: "", email: "", whatsapp: "", message: "" });
  };

  return (
    <div className="page-container section-y">
      <h1 className="font-serif text-3xl font-semibold">Contact {s.brandName}</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">Questions about a resource or your order? Reach us below.</p>
      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_1.3fr]">
        <div className="space-y-3">
          {links.length === 0 && <p className="text-sm text-muted-foreground">Use the form to send us a message.</p>}
          {links.map(({ href, label, Icon }) => (
            <Button key={label} variant="outline" className="h-12 w-full justify-start" asChild>
              <a href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" /> {label}
              </a>
            </Button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          {(["name", "email", "whatsapp"] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={k}>{k === "whatsapp" ? "WhatsApp number (optional)" : k === "name" ? "Name" : "Email"}</Label>
              <Input id={k} className="h-11" type={k === "email" ? "email" : "text"} value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Sending…" : "Send message"}</Button>
        </form>
      </div>
    </div>
  );
}
