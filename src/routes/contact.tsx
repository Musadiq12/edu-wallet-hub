import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Instagram, Mail, MessageCircle, Send, Youtube, Clock3 } from "lucide-react";
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
      { title: "Contact Us — Beststudy" },
      { name: "description", content: "Contact Beststudy for study material questions, corrections, suggestions, collaborations and technical support." },
      { property: "og:title", content: "Contact Us — Beststudy" },
      { property: "og:description", content: "Contact Beststudy by email, WhatsApp or the website contact form." },
      { property: "og:type", content: "website" },
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
    toast.success("Message sent. We'll get back to you within 24–48 hours.");
    setForm({ name: "", email: "", whatsapp: "", message: "" });
  };

  return (
    <main className="page-container section-y">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Contact Us — Beststudy</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">We are here to support your academic needs</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Whether you need exam updates, notes, previous papers, syllabus information, corrections, collaboration or help accessing the website, you can contact us.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <section>
              <h2 className="text-lg font-semibold">Why contact us?</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Subject-specific questions or doubts</li>
                <li>Suggestions or feedback</li>
                <li>Corrections or updates to published content</li>
                <li>Collaboration or contribution opportunities</li>
                <li>Technical issues or website access problems</li>
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold">Reach us</h2>
              <div className="mt-3 space-y-2">
                {links.length === 0 && <p className="text-sm text-muted-foreground">Use the contact form to send a message.</p>}
                {links.map(({ href, label, Icon }) => (
                  <Button key={label} variant="outline" className="h-12 w-full justify-start" asChild>
                    <a href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
                      <Icon className="mr-2 h-4 w-4" aria-hidden="true" /> {label}
                    </a>
                  </Button>
                ))}
              </div>
            </section>
            <section className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4" /> Office Hours</div>
              <p className="mt-2 text-sm text-muted-foreground">Monday to Saturday: 10:00 AM to 6:00 PM</p>
              <p className="mt-1 text-sm text-muted-foreground">Sunday: Closed (support via email only)</p>
              <p className="mt-2 text-xs text-muted-foreground">We aim to respond within 24–48 hours.</p>
            </section>
          </div>

          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold">Send a message</h2>
            {(["name", "email", "whatsapp"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={k}>{k === "whatsapp" ? "WhatsApp number (optional)" : k === "name" ? "Name" : "Email"}</Label>
                <Input id={k} className="h-11" type={k === "email" ? "email" : "text"} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" rows={6} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Sending…" : "Send message"}</Button>
          </form>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          We appreciate your trust in Beststudy and aim to make learning more accessible and less stressful for students.
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">Warm regards,<br />Danish Razaq Lone</p>
      </div>
    </main>
  );
}
