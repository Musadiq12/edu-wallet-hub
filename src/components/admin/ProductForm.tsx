import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminFileField, type PickedFile } from "@/components/admin/AdminFileField";
import { BUCKETS, LIMITS, friendlyError, removeFile, uploadFile, type AdminProduct } from "@/lib/admin";
import { categoriesQuery } from "@/lib/catalog";
import { discountPercent, slugify } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

type FormState = {
  title: string;
  slug: string;
  description: string;
  whats_included: string;
  category_id: string;
  course_label: string;
  subject_label: string;
  keywords: string;
  price: string;
  discounted_price: string;
  page_count: string;
  format: string;
  is_free: boolean;
  is_featured: boolean;
  is_active: boolean;
};

const emptyState: FormState = {
  title: "",
  slug: "",
  description: "",
  whats_included: "",
  category_id: "",
  course_label: "",
  subject_label: "",
  keywords: "",
  price: "",
  discounted_price: "",
  page_count: "",
  format: "PDF",
  is_free: false,
  is_featured: false,
  is_active: false,
};

export function ProductForm({ product }: { product?: AdminProduct | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: categories } = useQuery(categoriesQuery());

  const [form, setForm] = useState<FormState>(() =>
    product
      ? {
          title: product.title,
          slug: product.slug,
          description: product.description ?? "",
          whats_included: product.whats_included ?? "",
          category_id: product.category_id ?? "",
          course_label: product.course_label ?? "",
          subject_label: product.subject_label ?? "",
          keywords: product.keywords ?? "",
          price: String(product.price ?? ""),
          discounted_price: product.discounted_price != null ? String(product.discounted_price) : "",
          page_count: product.page_count != null ? String(product.page_count) : "",
          format: product.format ?? "PDF",
          is_free: product.is_free,
          is_featured: product.is_featured,
          is_active: product.is_active,
        }
      : emptyState,
  );
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [cover, setCover] = useState<PickedFile | null>(null);
  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [preview, setPreview] = useState<PickedFile | null>(null);
  const [paths, setPaths] = useState({
    cover_image: product?.cover_image ?? null,
    pdf_file: product?.pdf_file ?? null,
    preview_file: product?.preview_file ?? null,
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = (field: string) => {
    const errors: Record<string, string> = {};
    if (field === "title" && !form.title.trim()) errors.title = "Product title is required.";
    if (field === "slug" && (!form.slug.trim() || !/^[a-z0-9-]+$/.test(form.slug))) errors.slug = "Use lowercase letters, numbers and hyphens only.";
    if (field === "category_id" && !form.category_id) errors.category_id = "Choose a category.";
    if (field === "price" && !form.is_free && (!Number.isFinite(priceNum) || priceNum <= 0)) errors.price = "Enter a price greater than 0.";
    if (field === "discounted_price" && !form.is_free && discNum != null && (!Number.isFinite(discNum) || discNum < 0 || discNum >= priceNum)) errors.discounted_price = "Discounted price must be lower than the original price.";
    if (field === "page_count" && form.page_count && Number(form.page_count) < 0) errors.page_count = "Page count cannot be negative.";
    setFieldErrors((current) => { const next = { ...current, [field]: errors[field] }; if (!errors[field]) delete next[field]; return next; });
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({
      ...f,
      [k]: v,
      ...(k === "title" && !slugTouched ? { slug: slugify(String(v)) } : {}),
    }));

  const priceNum = Number(form.price || 0);
  const discNum = form.discounted_price === "" ? null : Number(form.discounted_price);
  const percent = useMemo(() => discountPercent(priceNum, discNum), [priceNum, discNum]);

  const validate = (): string | null => {
    if (!form.title.trim()) return "Enter a product title.";
    if (!form.slug.trim()) return "Enter a slug for the product URL.";
    if (!/^[a-z0-9-]+$/.test(form.slug)) return "The slug may only contain lowercase letters, numbers and hyphens.";
    if (!form.category_id) return "Choose a category.";
    if (!form.is_free) {
      if (!Number.isFinite(priceNum) || priceNum <= 0) return "Enter a valid price greater than 0.";
      if (discNum != null) {
        if (!Number.isFinite(discNum) || discNum < 0) return "Enter a valid discounted price.";
        if (discNum >= priceNum) return "The discounted price must be lower than the original price.";
      }
    }
    if (form.page_count && Number(form.page_count) < 0) return "Page count cannot be negative.";
    return null;
  };

  const save = async (publish: boolean | null) => {
    const problem = validate();
    if (problem) {
      setFieldErrors({ title: !form.title.trim() ? "Product title is required." : "", slug: !form.slug.trim() || !/^[a-z0-9-]+$/.test(form.slug) ? "Use lowercase letters, numbers and hyphens only." : "", category_id: !form.category_id ? "Choose a category." : "" });
    }
    if (problem) return void toast.error(problem);

    const willPublish = publish === null ? form.is_active : publish;
    if (willPublish && !pdf && !paths.pdf_file && !form.is_free) {
      return void toast.error("Upload the product PDF before publishing.");
    }

    setBusy(true);
    const next = { ...paths };
    const uploaded: { bucket: string; path: string }[] = [];
    try {
      if (cover) {
        setStatus("Uploading cover image…");
        const { path } = await uploadFile(BUCKETS.cover, cover.file, "covers");
        uploaded.push({ bucket: BUCKETS.cover, path });
        next.cover_image = path;
      }
      if (pdf) {
        setStatus("Uploading product PDF…");
        const { path } = await uploadFile(BUCKETS.file, pdf.file, "files");
        uploaded.push({ bucket: BUCKETS.file, path });
        next.pdf_file = path;
      }
      if (preview) {
        setStatus("Uploading preview PDF…");
        const { path } = await uploadFile(BUCKETS.preview, preview.file, "previews");
        uploaded.push({ bucket: BUCKETS.preview, path });
        next.preview_file = path;
      }

      setStatus("Saving product…");
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        whats_included: form.whats_included.trim() || null,
        category_id: form.category_id,
        course_label: form.course_label.trim() || null,
        subject_label: form.subject_label.trim() || null,
        keywords: form.keywords.trim() || null,
        price: form.is_free ? 0 : priceNum,
        discounted_price: form.is_free ? null : discNum,
        page_count: form.page_count ? Number(form.page_count) : null,
        format: form.format.trim() || "PDF",
        is_free: form.is_free,
        is_featured: form.is_featured,
        is_active: willPublish,
        cover_image: next.cover_image,
        pdf_file: next.pdf_file,
        preview_file: next.preview_file,
      };

      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
        // Replaced files are no longer referenced — clear them from storage.
        if (cover && paths.cover_image && paths.cover_image !== next.cover_image) await removeFile(BUCKETS.cover, paths.cover_image);
        if (pdf && paths.pdf_file && paths.pdf_file !== next.pdf_file) await removeFile(BUCKETS.file, paths.pdf_file);
        if (preview && paths.preview_file && paths.preview_file !== next.preview_file) await removeFile(BUCKETS.preview, paths.preview_file);
      } else {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase.from("products").insert({ ...payload, created_by: auth.user?.id ?? null });
        if (error) throw error;
      }

      await qc.invalidateQueries({ queryKey: ["admin"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["product"] });
      toast.success(product ? "Product saved." : willPublish ? "Product published." : "Draft saved.");
      void navigate({ to: "/admin/products" });
    } catch (err) {
      // Roll back files uploaded in this failed attempt.
      for (const u of uploaded) await removeFile(u.bucket, u.path);
      toast.error(friendlyError(err, "Could not save the product. Please try again."));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void save(null);
      }}
    >
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basic information</h2>
        <div className="space-y-1.5">
          <Label htmlFor="title">Product title</Label>
          <Input id="title" className="h-11" value={form.title} onChange={(e) => set("title", e.target.value)} onBlur={() => validateField("title")} aria-invalid={!!fieldErrors.title} required />
          {fieldErrors.title && <p className="text-xs text-destructive">{fieldErrors.title}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            className="h-11"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", slugify(e.target.value));
            }}
            required
          />
          <p className="text-xs text-muted-foreground">Public URL: /shop/{form.slug || "your-product-slug"}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whats_included">What&apos;s included</Label>
          <Textarea id="whats_included" rows={3} value={form.whats_included} onChange={(e) => set("whats_included", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger id="category" className="h-11" aria-invalid={!!fieldErrors.category_id} onBlur={() => validateField("category_id")}><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="course">Course / programme</Label>
            <Input id="course" className="h-11" value={form.course_label} onChange={(e) => set("course_label", e.target.value)} placeholder="e.g. BCOMG" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" className="h-11" value={form.subject_label} onChange={(e) => set("subject_label", e.target.value)} placeholder="e.g. Business Law" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="keywords">Search keywords</Label>
          <Input id="keywords" className="h-11" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="Comma separated" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="price">Original price (₹)</Label>
            <Input id="price" type="number" min="0" step="1" inputMode="decimal" className="h-11" value={form.price} disabled={form.is_free} onChange={(e) => set("price", e.target.value)} onBlur={() => validateField("price")} aria-invalid={!!fieldErrors.price} />
            {fieldErrors.price && <p className="text-xs text-destructive">{fieldErrors.price}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discounted">Discounted price (₹)</Label>
            <Input id="discounted" type="number" min="0" step="1" inputMode="decimal" className="h-11" value={form.discounted_price} disabled={form.is_free} onChange={(e) => set("discounted_price", e.target.value)} onBlur={() => validateField("discounted_price")} aria-invalid={!!fieldErrors.discounted_price} />
            {fieldErrors.discounted_price && <p className="text-xs text-destructive">{fieldErrors.discounted_price}</p>}
          </div>
        </div>
        {percent != null && (
          <p className="inline-flex rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">{percent}% OFF</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Files</h2>
        <AdminFileField
          id="cover" label="Product cover image" kind="image" accept="image/*"
          maxBytes={LIMITS.coverBytes} help="JPG or PNG, up to 5 MB."
          existingPath={paths.cover_image} picked={cover} busy={busy} status={status ?? ""}
          onPick={setCover} onRemoveExisting={() => setPaths((p) => ({ ...p, cover_image: null }))}
        />
        <AdminFileField
          id="pdf" label="Product PDF (private)" kind="pdf" accept="application/pdf"
          maxBytes={LIMITS.fileBytes} help="Stored privately. Delivered manually after payment verification. Up to 50 MB."
          existingPath={paths.pdf_file} picked={pdf} busy={busy} status={status ?? ""}
          onPick={setPdf} onRemoveExisting={() => setPaths((p) => ({ ...p, pdf_file: null }))}
        />
        <AdminFileField
          id="preview" label="Preview / sample PDF (optional)" kind="pdf" accept="application/pdf"
          maxBytes={LIMITS.previewBytes} help="Shown to students as a free sample. Up to 20 MB."
          existingPath={paths.preview_file} picked={preview} busy={busy} status={status ?? ""}
          onPick={setPreview} onRemoveExisting={() => setPaths((p) => ({ ...p, preview_file: null }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Additional information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pages">Page count</Label>
            <Input id="pages" type="number" min="0" className="h-11" value={form.page_count} onChange={(e) => set("page_count", e.target.value)} onBlur={() => validateField("page_count")} aria-invalid={!!fieldErrors.page_count} />
            {fieldErrors.page_count && <p className="text-xs text-destructive">{fieldErrors.page_count}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="format">Format</Label>
            <Input id="format" className="h-11" value={form.format} onChange={(e) => set("format", e.target.value)} />
          </div>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          {[
            { key: "is_featured" as const, label: "Featured product", hint: "Shown in the featured section on the homepage." },
            { key: "is_free" as const, label: "Free product", hint: "Listed under Free Resources; price is ignored." },
            { key: "is_active" as const, label: "Published", hint: "Visible on the public Shop page." },
          ].map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor={row.key} className="text-sm">{row.label}</Label>
                <p className="text-xs text-muted-foreground">{row.hint}</p>
              </div>
              <Switch id={row.key} checked={form[row.key]} onCheckedChange={(v) => set(row.key, v)} />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
        <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => void save(false)}>
          Save as draft
        </Button>
        <Button type="button" className="h-11" disabled={busy} onClick={() => void save(true)}>
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{status ?? "Working…"}</> : "Publish"}
        </Button>
        {product && (
          <Button type="submit" variant="ghost" className="h-11" disabled={busy}>
            Save changes
          </Button>
        )}
      </div>
    </form>
  );
}
