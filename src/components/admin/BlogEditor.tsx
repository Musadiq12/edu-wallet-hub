import { useRef, useState } from "react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { savePost, type BlogPost, coverImageUrl, uniqueSlugCheck } from "@/lib/blog";
import { uploadFile, LIMITS, friendlyError } from "@/lib/admin";

export function BlogEditor({ initial, onSaved }: { initial?: BlogPost; onSaved: (id: string) => void }) {
  const qc = useQueryClient();
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [v, V] = useState<Partial<BlogPost>>(initial ?? {
    title: "", slug: "", excerpt: "", content: "", category: "", tags: [],
    cover_image: "", meta_title: "", meta_description: "", status: "draft",
  });
  const [preview, P] = useState(false);
  const [busy, B] = useState(false);
  const [showLinkFields, setShowLinkFields] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const set = (k: keyof BlogPost, x: unknown) => V(a => ({ ...a, [k]: x }));

  const openLinkFields = () => {
    const textarea = contentRef.current;
    const start = textarea?.selectionStart ?? (v.content ?? "").length;
    const end = textarea?.selectionEnd ?? start;
    selectionRef.current = { start, end };
    setLinkText(textarea && start !== end ? textarea.value.slice(start, end) : "");
    setShowLinkFields(open => !open);
  };

  const insertLink = () => {
    const label = linkText.trim();
    const url = linkUrl.trim();
    if (!label || !url) return toast.error("Enter both link text and URL.");
    if (!/^(https?:\/\/|\/)/i.test(url)) {
      return toast.error("Use a full https:// URL or an internal path starting with /.");
    }
    const content = v.content ?? "";
    const { start, end } = selectionRef.current;
    const markdown = `[${label.replace(/\]/g, "\\\\]")}](${url.replace(/\)/g, "%29")})`;
    const safeStart = Math.min(start, content.length);
    const safeEnd = Math.min(Math.max(end, safeStart), content.length);
    const next = content.slice(0, safeStart) + markdown + content.slice(safeEnd);
    set("content", next);
    setShowLinkFields(false);
    setLinkText("");
    setLinkUrl("");
    requestAnimationFrame(() => {
      if (!contentRef.current) return;
      const cursor = safeStart + markdown.length;
      contentRef.current.focus();
      contentRef.current.setSelectionRange(cursor, cursor);
    });
  };

  const save = async (status: "draft" | "published") => {
    if (!v.title || !v.slug || !v.excerpt || !v.content) {
      return toast.error("Title, slug, excerpt, and content are required.");
    }
    try {
      if (!(await uniqueSlugCheck(v.slug, initial?.id))) return toast.error("This slug is already used.");
      B(true);
      const p = await savePost({ ...v, slug: v.slug, title: v.title, excerpt: v.excerpt, content: v.content, status });
      await qc.invalidateQueries({ queryKey: ["admin", "blog"] });
      await qc.invalidateQueries({ queryKey: ["blog"] });
      toast.success("Article saved");
      onSaved(p.id);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      B(false);
    }
  };

  const upload = async (f?: File) => {
    if (!f) return;
    if (f.size > LIMITS.coverBytes) return toast.error("Maximum image size is 5 MB");
    try {
      const x = await uploadFile("blog-covers", f, "blog");
      set("cover_image", x.path);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold">{initial ? "Edit article" : "New article"}</h1>
      <label className="block text-sm">Title
        <Input value={v.title ?? ""} onChange={e => {
          set("title", e.target.value);
          if (!initial) set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        }} />
      </label>
      <label className="block text-sm">Slug
        <Input value={v.slug ?? ""} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
      </label>
      <label className="block text-sm">Category
        <Input value={v.category ?? ""} onChange={e => set("category", e.target.value)} list="blogcats" />
        <datalist id="blogcats">{["NEET", "JEE", "UPSC", "SSC CGL", "Banking", "CLAT", "Study Tips"].map(x => <option key={x}>{x}</option>)}</datalist>
      </label>
      <label className="block text-sm">Tags, comma separated
        <Input value={(v.tags ?? []).join(", ")} onChange={e => set("tags", e.target.value.split(",").map(x => x.trim()).filter(Boolean))} />
      </label>
      <label className="block text-sm">Excerpt (max 300)
        <Textarea maxLength={300} value={v.excerpt ?? ""} onChange={e => set("excerpt", e.target.value)} />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!preview ? "default" : "outline"} onClick={() => P(false)}>Edit Markdown</Button>
        <Button size="sm" variant={preview ? "default" : "outline"} onClick={() => P(true)}>Preview</Button>
        {!preview && <Button size="sm" type="button" variant="outline" onClick={openLinkFields}>Insert link</Button>}
      </div>

      {showLinkFields && !preview && (
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <label className="block text-sm">Link text
            <Input autoComplete="off" placeholder="e.g. Free study resources" value={linkText} onChange={e => setLinkText(e.target.value)} />
          </label>
          <label className="block text-sm">Link URL or internal path
            <Input autoComplete="url" placeholder="https://example.com or /free-resources" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" size="sm" onClick={insertLink}>Add link to article</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowLinkFields(false)}>Cancel</Button>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Select text in the article first to use it as the link text. The link is inserted at your cursor, or at the end if nothing is selected.</p>
        </div>
      )}

      {preview ? (
        <div className="prose-blog rounded border p-4"><MarkdownContent content={v.content ?? ""} /></div>
      ) : (
        <Textarea ref={contentRef} rows={16} className="font-mono" value={v.content ?? ""} onChange={e => set("content", e.target.value)} onSelect={e => {
          selectionRef.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd };
        }} placeholder={"Write your article in Markdown...\n\nSelect text and click Insert link to attach a URL."} />
      )}

      <label className="block text-sm">Cover image (5 MB max)
        <Input type="file" accept="image/*" onChange={e => void upload(e.target.files?.[0])} />
      </label>
      {v.cover_image && <div className="flex items-center gap-3">
        <img src={coverImageUrl(v.cover_image)} alt="Cover preview" className="h-24 rounded" />
        <Button variant="outline" onClick={() => set("cover_image", "")}>Remove cover</Button>
      </div>}
      <label className="block text-sm">Meta title ({(v.meta_title ?? "").length}/70)
        <Input maxLength={70} value={v.meta_title ?? ""} onChange={e => set("meta_title", e.target.value)} />
      </label>
      <label className="block text-sm">Meta description ({(v.meta_description ?? "").length}/160)
        <Textarea maxLength={160} value={v.meta_description ?? ""} onChange={e => set("meta_description", e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <Button disabled={busy} variant="outline" onClick={() => void save("draft")}>Save draft</Button>
        <Button disabled={busy} onClick={() => void save("published")}>Save & publish</Button>
      </div>
    </div>
  );
}
