import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileCheck2, FileUp, ShieldCheck, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { BRAND, buildMeta, buildTitle } from "@/lib/seo";

type MarketplaceRole = "buyer" | "seller" | "admin";
type ApplicationStatus = "pending" | "approved" | "rejected";
type SellerApplication = {
  id: string;
  user_id: string;
  full_name: string;
  profession: string;
  education: string;
  exams?: string[] | null;
  id_card_path: string | null;
  upi_id: string;
  status: ApplicationStatus;
  rejection_reason: string | null;
  created_at: string;
};

const EXAMS = ["NEET", "JEE", "UPSC", "SSC", "CGL", "CLAT", "CA", "Other"] as const;
const MAX_ID_BYTES = 5 * 1024 * 1024;
const ALLOWED_ID_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

const appTable = supabase.from("seller_applications") as unknown as {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: SellerApplication | null; error: { message?: string } | null }>;
    };
  };
  insert: (row: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
  update: (row: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

export const Route = createFileRoute("/become-seller")({
  head: () => ({
    meta: [
      { title: buildTitle(["Become a Seller", BRAND]) },
      { name: "description", content: buildMeta("Apply to sell your original exam notes and study resources on EduWallet.") },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: BecomeSellerPage,
});

function humanError(error: unknown) {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : typeof error === "string" ? error : "";
  const lower = message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("42501")) {
    return "Your application could not be saved because database permissions blocked the request. Please contact support.";
  }
  if (lower.includes("duplicate key") || lower.includes("already exists")) {
    return "An application already exists for this account. Refresh the page and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Network issue. Check your connection and try again.";
  }
  if (lower.includes("bucket") || lower.includes("storage")) {
    return "Your ID card could not be uploaded. Please try another PDF, JPG, or PNG file up to 5 MB. If this continues, contact support.";
  }
  if (lower.includes("seller_applications") || lower.includes("schema cache") || lower.includes("column")) {
    return "The seller application service is not fully available yet. Please contact support and mention “seller application database configuration”.";
  }
  if (lower.includes("23505")) return "An application already exists for this account. Refresh the page to check its status.";
  return "We could not complete your application. Please check your connection and try again. If it continues, contact support.";
}

function safeFilename(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(-100) || "identity-document";
}

function BecomeSellerPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useSession();
  const [role, setRole] = useState<MarketplaceRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [profession, setProfession] = useState("");
  const [education, setEducation] = useState("");
  const [upiId, setUpiId] = useState("");
  const [exams, setExams] = useState<string[]>([]);
  const [idCard, setIdCard] = useState<File | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      void navigate({ to: "/login", search: { redirect: "/become-seller" }, replace: true });
      setRoleLoading(false);
      setApplicationLoading(false);
      return;
    }

    setRoleLoading(true);
    const profilesTable = supabase.from("profiles") as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { role?: string | null; full_name?: string | null } | null; error: { message?: string } | null }>;
        };
      };
    };
    profilesTable.select("role,full_name").eq("id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setFormError("We couldn't verify your account role. Refresh the page and try again.");
          setRole(null);
        } else {
          const row = data as { role?: string | null; full_name?: string | null } | null;
          const nextRole = row?.role === "seller" || row?.role === "admin" ? row.role : "buyer";
          setRole(nextRole);
          if (row?.full_name) setFullName(row.full_name);
        }
        setRoleLoading(false);
      });

    appTable.select("id,user_id,full_name,profession,education,exams,id_card_path,upi_id,status,rejection_reason,created_at")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const message = String(error.message ?? "").toLowerCase();
          setFormError(
            message.includes("seller_applications") && (message.includes("does not exist") || message.includes("schema cache"))
              ? "Seller applications are not enabled in the live database yet. The marketplace database migration must be applied before you can submit."
              : "We couldn’t load your application status. Check your connection and try again. If this continues, contact support.",
          );
        }
        else if (data) {
          setApplication(data);
          setFullName(data.full_name ?? "");
          setProfession(data.profession ?? "");
          setEducation(data.education ?? "");
          setUpiId(data.upi_id ?? "");
          setExams(Array.isArray(data.exams) ? data.exams : []);
        }
        setApplicationLoading(false);
      });

    return () => { active = false; };
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && !roleLoading && !applicationLoading
      && (role === "seller" || role === "admin" || application?.status === "approved")) {
      void navigate({ to: "/seller/dashboard", replace: true });
    }
  }, [application?.status, applicationLoading, authLoading, navigate, role, roleLoading]);

  const toggleExam = (exam: string) => {
    setExams((current) => current.includes(exam) ? current.filter((item) => item !== exam) : [...current, exam]);
  };

  const validate = () => {
    if (!role) return "Your account role could not be verified. Refresh the page before submitting.";
    if (fullName.trim().length < 2 || fullName.trim().length > 100) return "Enter your full name (2–100 characters).";
    if (!profession.trim() || profession.trim().length > 100) return "Enter your profession (up to 100 characters).";
    if (!education.trim() || education.trim().length > 200) return "Enter your education or qualification (up to 200 characters).";
    if (exams.length === 0) return "Choose at least one exam you create notes for.";
    if (!idCard && !(application?.status === "rejected" && application.id_card_path)) return "Upload your ID card.";
    if (idCard && !ALLOWED_ID_TYPES.includes(idCard.type)) return "ID card must be a PDF, JPG, or PNG file.";
    if (idCard && idCard.size > MAX_ID_BYTES) return "ID card must be 5 MB or smaller.";
    if (!UPI_PATTERN.test(upiId.trim())) return "Enter a valid UPI ID, for example name@bank.";
    if (!agreementAccepted) return "Accept the Seller Agreement to continue.";
    return "";
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;
    if (!user) {
      void navigate({ to: "/login", search: { redirect: "/become-seller" }, replace: true });
      return;
    }
    const invalid = validate();
    if (invalid) {
      setFormError(invalid);
      return;
    }
    if (role !== "buyer" || (application && application.status !== "rejected")) {
      setFormError("This account is not eligible to submit an application right now. Refresh the page.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setFormError("");
    setSuccess(false);
    let uploadedPath: string | null = null;

    try {
      if (idCard) {
        // Keep the client and storage key aligned: one ID document per application.
        const extension = idCard.type === "application/pdf" ? "pdf" : idCard.type === "image/jpeg" ? "jpg" : "png";
        const path = user.id + "/" + crypto.randomUUID() + "-" + safeFilename(idCard.name.replace(/\.[^.]+$/, "")) + "." + extension;
        const { error: uploadError } = await supabase.storage.from("seller-documents").upload(path, idCard, {
          cacheControl: "3600",
          upsert: false,
          contentType: idCard.type,
        });
        if (uploadError) throw uploadError;
        uploadedPath = path;
      }

      const payload = {
        user_id: user.id,
        full_name: fullName.trim(),
        profession: profession.trim(),
        education: education.trim(),
        exams,
        id_card_path: uploadedPath ?? application?.id_card_path ?? null,
        upi_id: upiId.trim(),
        status: "pending",
        rejection_reason: null,
        reviewed_at: null,
      };

      let error: { message?: string } | null = null;
      if (application?.status === "rejected") {
        // Application policy and trigger permit only a rejected -> pending transition.
        const result = await appTable.update(payload).eq("id", application.id).eq("user_id", user.id);
        error = result.error;
      } else {
        const result = await appTable.insert(payload);
        error = result.error;
      }
      if (error) throw new Error("seller_applications insert failed: " + (error.message ?? "unknown database error"));

      setApplication({
        id: application?.id ?? crypto.randomUUID(),
        user_id: user.id,
        full_name: fullName.trim(),
        profession: profession.trim(),
        education: education.trim(),
        exams,
        id_card_path: uploadedPath ?? application?.id_card_path ?? null,
        upi_id: upiId.trim(),
        status: "pending",
        rejection_reason: null,
        created_at: application?.created_at ?? new Date().toISOString(),
      });
      setSuccess(true);
      toast.success("Seller application submitted.");
    } catch (error) {
      console.error("[seller-application] submission failed", error);
      const message = humanError(error);
      setFormError(message);
      toast.error(message);
      if (uploadedPath) await supabase.storage.from("seller-documents").remove([uploadedPath]).catch(() => undefined);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (authLoading || roleLoading || applicationLoading) {
    return <div className="page-container flex min-h-[60vh] items-center justify-center py-16"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Checking your seller application…</div></div>;
  }
  if (!user) return null;
  if (role === "seller" || role === "admin" || application?.status === "approved") return null;

  if (application?.status === "pending") {
    return (
      <div className="page-container section-y">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"><Clock3 className="size-6" /></div>
          <h1 className="mt-5 font-serif text-3xl font-semibold">Your application is under review</h1>
          <p className="mt-3 leading-7 text-muted-foreground">Your application is under review. We usually respond within 24–48 hours.</p>
          <p className="mt-6 text-sm text-muted-foreground">You can leave this page and keep using your EduWallet buyer account while the review is pending.</p>
          <Button asChild className="mt-6"><Link to="/library">Return to My Library <ArrowRight className="ml-2 size-4" /></Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container section-y">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
        <aside className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg sm:p-8 lg:sticky lg:top-24">
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary-foreground/20 bg-primary-foreground/10"><FileCheck2 className="size-6" /></div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-primary-foreground/70">EduWallet marketplace</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Share your knowledge. Reach more learners.</h1>
          <p className="mt-4 text-sm leading-6 text-primary-foreground/80">Apply to become a seller and offer your original notes to students preparing for competitive and professional exams.</p>
          <div className="mt-7 space-y-4">
            {[
              ["Private document review", "Your ID document is stored in a private bucket."],
              ["Original study resources", "Only upload work that you created or have the right to sell."],
              ["Application review", "We usually respond within 24–48 hours."],
            ].map(([title, description]) => (
              <div key={title} className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-foreground/80" />
                <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-primary-foreground/70">{description}</p></div>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-secondary">Seller application</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">{application?.status === "rejected" ? "Update your application" : "Become a Seller"}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Complete your seller profile below. Required fields are marked with an asterisk; your identity document remains private.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground"><span className="rounded-full border border-border bg-background px-3 py-1.5">1. Your details</span><span className="rounded-full border border-border bg-background px-3 py-1.5">2. Verification</span><span className="rounded-full border border-border bg-background px-3 py-1.5">3. Review</span></div>
          </div>

          {application?.status === "rejected" && (
            <div className="mx-5 mt-5 flex gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm sm:mx-8">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div><p className="font-semibold text-foreground">Your previous application was rejected</p><p className="mt-1 leading-6 text-muted-foreground">{application.rejection_reason?.trim() || "No reason was provided. Update your details and resubmit for review."}</p></div>
            </div>
          )}

          {success ? (
            <div className="p-6 sm:p-8">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><CheckCircle2 className="size-6" /></div>
              <h3 className="mt-4 text-xl font-semibold">Application submitted</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Your application is under review. We usually respond within 24–48 hours.</p>
              <Button className="mt-6" onClick={() => { setSuccess(false); setApplication((current) => current ? { ...current, status: "pending" } : current); }}>View application status</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-6 p-5 sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="seller-full-name">Full name <span className="text-destructive">*</span></Label>
                  <Input id="seller-full-name" required autoComplete="name" maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seller-profession">Profession <span className="text-destructive">*</span></Label>
                  <Input id="seller-profession" required maxLength={100} value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Student, teacher, tutor…" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seller-education">Education / qualification <span className="text-destructive">*</span></Label>
                  <Input id="seller-education" required maxLength={200} value={education} onChange={(e) => setEducation(e.target.value)} placeholder="e.g. B.Com, MBBS student" className="h-11" />
                </div>
                <fieldset className="space-y-3 sm:col-span-2">
                  <legend className="text-sm font-medium">Exams you create notes for <span className="text-destructive">*</span></legend>
                  <p className="text-xs text-muted-foreground">Choose all that apply.</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {EXAMS.map((exam) => (
                      <label key={exam} className={"flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors " + (exams.includes(exam) ? "border-primary bg-primary/5 text-foreground" : "border-input bg-background text-muted-foreground hover:bg-muted/50")}>
                        <input type="checkbox" value={exam} checked={exams.includes(exam)} onChange={() => toggleExam(exam)} className="size-4 accent-[var(--color-primary)]" />
                        <span>{exam}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="seller-id-card">ID card (PDF, JPG or PNG) <span className="text-destructive">*</span></Label>
                  <label htmlFor="seller-id-card" className="group flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/25 bg-muted/20 px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/5">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"><UploadCloud className="size-5" /></span>
                    <span className="mt-3 max-w-full truncate px-3 text-sm font-semibold">{idCard ? "ID card selected" : application?.status === "rejected" && application.id_card_path ? "Choose a replacement ID card (optional)" : "Select one ID card"}</span>
                    <span className="mt-1 text-xs text-muted-foreground">PDF, JPG or PNG · Up to 5 MB · One file only</span>
                    <input id="seller-id-card" type="file" multiple={false} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { const file = e.target.files?.[0] ?? null; setIdCard(file); setFormError(""); }} />
                  </label>
                  {idCard && (
                    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileCheck2 className="size-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={idCard.name}>{idCard.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{idCard.type === "application/pdf" ? "PDF document" : idCard.type === "image/jpeg" ? "JPEG image" : "PNG image"} · {(idCard.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <button type="button" onClick={() => { setIdCard(null); const input = document.getElementById("seller-id-card") as HTMLInputElement | null; if (input) input.value = ""; }} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Remove selected ID card"><X className="size-3.5" />Remove</button>
                    </div>
                  )}
                  {application?.status === "rejected" && application.id_card_path && !idCard && <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">Your previously submitted ID will be reused unless you choose a replacement.</p>}
                  <p className="text-xs leading-5 text-muted-foreground">Your file is stored privately and can only be accessed by you and authorized EduWallet reviewers.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="seller-upi">UPI ID <span className="text-destructive">*</span></Label>
                  <Input id="seller-upi" required autoComplete="off" maxLength={320} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" className="h-11" />
                  <p className="text-xs text-muted-foreground">Enter the UPI ID where you want payouts sent if your application is approved.</p>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 text-sm leading-6">
                <input type="checkbox" required checked={agreementAccepted} onChange={(e) => setAgreementAccepted(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]" />
                <span>I confirm all notes I upload will be my own original work and I accept the <Link to="/seller-agreement" className="font-semibold text-primary underline underline-offset-4">Seller Agreement</Link>.</span>
              </label>

              {formError && <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{formError}</span></div>}
              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">Your status is always set to pending when submitted.</p>
                <Button type="submit" disabled={busy} className="h-12 w-full sm:w-auto sm:min-w-48">
                  {busy ? <><span className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Submitting…</> : <><FileUp className="mr-2 size-4" />{application?.status === "rejected" ? "Resubmit application" : "Submit application"}</>}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
