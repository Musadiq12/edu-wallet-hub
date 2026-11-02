import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Bold, Code, Eye, Heading1, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Minus, Pilcrow, Quote, Redo2, Strikethrough, Table2, Underline as UnderlineIcon, Undo2, Video, AlignLeft, AlignCenter, AlignRight, Save, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { savePost, type BlogPost, coverImageUrl, uniqueSlugCheck } from "@/lib/blog";
import { uploadFile, LIMITS, friendlyError } from "@/lib/admin";
import { MarkdownContent } from "@/components/MarkdownContent";
import "@/components/blog-editor.css";
import { Link as RouterLink } from "@tanstack/react-router";

type RichEditorProps = { initial?: BlogPost; onSaved: (id: string) => void };
type ImageUploadHandler = (file: File) => void;

const categories = ["NEET", "JEE", "UPSC", "SSC CGL", "Banking", "CLAT", "Study Tips"];

function toEditorContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) return trimmed;

  // Legacy Markdown posts remain editable without attempting unsafe HTML parsing.
  const blocks = trimmed.split(/\n\s*\n/).map((block) => {
    const heading = block.match(/^(#{1,4})\s+([\s\S]+)$/);
    if (heading) {
      const level = heading[1].length;
      return `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
    }
    if (/^>\s?/m.test(block)) {
      return `<blockquote><p>${escapeHtml(block.replace(/^>\s?/gm, "").replace(/\n/g, " "))}</p></blockquote>`;
    }
    if (/^\d+\.\s/m.test(block)) {
      return `<ol>${block.split("\n").map((line) => `<li><p>${escapeHtml(line.replace(/^\d+\.\s/, ""))}</p></li>`).join("")}</ol>`;
    }
    if (/^[-*+]\s/m.test(block)) {
      return `<ul>${block.split("\n").map((line) => `<li><p>${escapeHtml(line.replace(/^[-*+]\s/, ""))}</p></li>`).join("")}</ul>`;
    }
    return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
  });
  return blocks.join("");
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function ToolbarButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`grid size-9 place-items-center rounded-lg border text-sm transition-colors disabled:opacity-40 ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"}`}>{children}</button>;
}

export function BlogEditor({ initial, onSaved }: RichEditorProps) {
  const qc = useQueryClient();
  const bodyFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineUploadRef = useRef<ImageUploadHandler>(() => undefined);
  const savedOnce = useRef(false);
  const [v, setV] = useState<Partial<BlogPost>>(initial ?? {
    title: "", slug: "", excerpt: "", content: "", category: "", tags: [],
    cover_image: "", meta_title: "", meta_description: "", status: "draft",
    seo_title: "", seo_description: "",
  });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [darkWriting, setDarkWriting] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [showImageDetails, setShowImageDetails] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1,2,3,4] }, codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http","https","mailto"] }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "blog-editor-image" } }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      Youtube.configure({ controls: true, nocookie: true, modestBranding: true, width: 720, height: 405 }),
      Placeholder.configure({ placeholder: "Start writing. Type / for your flow, or use the toolbar above…" }),
      TextAlign.configure({ types: ["heading", "paragraph", "image"] }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: toEditorContent(v.content ?? ""),
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "blog-tiptap-content", spellcheck: "true", "aria-label": "Article body" },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved || !event.dataTransfer?.files?.length) return false;
        const file = Array.from(event.dataTransfer.files).find((x) => x.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        inlineUploadRef.current(file);
        return true;
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        inlineUploadRef.current(file);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      setV((old) => ({ ...old, content: html }));
    },
  });

  const set = (key: keyof BlogPost, value: unknown) => setV((old) => ({ ...old, [key]: value }));
  const stats = useMemo(() => {
    const text = editor?.getText() ?? "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { words, reading: Math.max(1, Math.ceil(words / 200)) };
  }, [editor, v.content]);

  const uploadInlineImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file.");
    if (file.size > LIMITS.coverBytes) return toast.error("Inline images must be 5 MB or smaller.");
    setUploading(true);
    try {
      const uploaded = await uploadFile("blog-covers", file, "blog-inline");
      const src = coverImageUrl(uploaded.path);
      if (!src) throw new Error("The image upload did not return a usable URL.");
      editor?.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, "") }).run();
      toast.success("Image added to article");
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setUploading(false);
    }
  }, [editor]);

  const uploadCover = async (file?: File) => {
    if (!file) return;
    if (file.size > LIMITS.coverBytes) return toast.error("Cover images must be 5 MB or smaller.");
    try {
      const uploaded = await uploadFile("blog-covers", file, "blog");
      set("cover_image", uploaded.path);
      toast.success("Cover image uploaded");
    } catch (error) { toast.error(friendlyError(error)); }
  };

  const doSave = useCallback(async (mode: "draft" | "published" | "scheduled" = "draft", notify = true) => {
    const content = editor?.getHTML() ?? v.content ?? "";
    const text = editor?.getText() ?? "";
    if (!v.title?.trim() || !v.slug?.trim() || !text.trim()) {
      if (notify) toast.error("Add a title, slug, and article content before saving.");
      return null;
    }
    try {
      setBusy(true);
      if (!(await uniqueSlugCheck(v.slug, initial?.id))) {
        if (notify) toast.error("This article slug is already in use.");
        return null;
      }
      const status = mode;
      if (status === "scheduled" && (!v.scheduled_at || new Date(v.scheduled_at).getTime() <= Date.now())) {
        if (notify) toast.error("Choose a future publish date and time.");
        return null;
      }
      const post = await savePost({
        ...v, id: initial?.id, title: v.title.trim(), slug: v.slug.trim(),
        excerpt: v.excerpt ?? "", content, status,
        published_at: status === "published" ? (v.published_at ?? new Date().toISOString()) : null,
        scheduled_at: status === "scheduled" ? v.scheduled_at ?? null : null,
      });
      savedOnce.current = true;
      await qc.invalidateQueries({ queryKey: ["admin", "blog"] });
      await qc.invalidateQueries({ queryKey: ["blog"] });
      if (notify) toast.success(status === "published" ? "Article published" : status === "scheduled" ? "Article scheduled" : "Draft saved");
      onSaved(post.id);
      return post.id;
    } catch (error) {
      if (notify) toast.error(friendlyError(error));
      return null;
    } finally { setBusy(false); }
  }, [editor, v, initial?.id, qc, onSaved]);

  useEffect(() => {
    if (!editor || !v.title?.trim() || !v.slug?.trim() || !editor.getText().trim()) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const currentStatus = v.status === "published" ? "published" : "draft";
      void doSave(currentStatus, false);
    }, 1800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [v.title, v.slug, v.content, v.excerpt, v.category, v.tags, v.cover_image, v.meta_title, v.meta_description, v.status, editor, doSave]);

  const addTag = () => {
    const clean = tagDraft.trim().replace(/^#/, "");
    if (!clean) return;
    if (!(v.tags ?? []).some((x) => x.toLowerCase() === clean.toLowerCase())) set("tags", [...(v.tags ?? []), clean]);
    setTagDraft("");
  };

  const addLink = () => {
    const url = window.prompt("Enter the URL (https:// or internal path /...):");
    if (!url || !editor) return;
    if (!/^(https?:\/\/|\/)/i.test(url)) return toast.error("Use https:// or an internal path beginning with /.");
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addVideo = () => {
    if (!videoUrl.trim()) return toast.error("Enter a YouTube URL.");
    if (!editor?.commands.setYoutubeVideo({ src: videoUrl.trim() })) toast.error("Enter a valid YouTube URL.");
    else setVideoUrl("");
  };

  const insertTable = () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const insertDivider = () => editor?.chain().focus().setHorizontalRule().run();

  const imageNode = editor?.getAttributes("image");
  const updateImageDetails = () => {
    if (!editor?.isActive("image")) return toast.error("Select an image in the article first.");
    editor.chain().focus().updateAttributes("image", { alt: imageAlt, title: captionText }).run();
    setShowImageDetails(false);
  };

  const publish = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await doSave("published");
  };

  const insertImage = (file?: File) => { if (file) void uploadInlineImage(file); };

  return (
    <div className="blog-admin-editor mx-auto w-full max-w-[1500px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><RouterLink to="/admin/blog"><ArrowLeft className="size-4"/></RouterLink></Button>
          <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">EduWallet · Editorial</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{initial ? "Edit article" : "Create an article"}</h1><p className="mt-1 text-sm text-muted-foreground">A focused writing space for useful, search-friendly content.</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:block">{busy ? "Saving…" : savedOnce.current ? "Autosaved" : "Draft workspace"}</span>
          <Button variant="outline" size="icon" aria-label="Toggle editor theme" onClick={() => setDarkWriting((x)=>!x)}>{darkWriting?<Sun className="size-4"/>:<Moon className="size-4"/>}</Button>
          <Button variant="outline" disabled={busy} onClick={() => void doSave("draft")}><Save className="mr-2 size-4"/>Save draft</Button>
          <Button disabled={busy} variant="outline" onClick={() => void schedule()}>Schedule</Button>
          <Button disabled={busy} variant="outline" onClick={() => void schedule()}>Schedule</Button>
          <Button disabled={busy} onClick={() => void publish()}>{busy?<Loader2 className="mr-2 size-4 animate-spin"/>:null}Publish</Button>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Article title</label>
            <Input className="h-auto border-0 px-0 py-2 text-2xl font-semibold shadow-none focus-visible:ring-0 sm:text-4xl" value={v.title ?? ""} placeholder="Give your article a clear title…" onChange={(e)=>{set("title",e.target.value);if(!initial)set("slug",e.target.value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""));}}/>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]">
              <label className="text-xs text-muted-foreground">URL slug<Input className="mt-1" value={v.slug??""} onChange={(e)=>set("slug",e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))}/></label>
              <label className="text-xs text-muted-foreground">Category<select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={v.category??""} onChange={(e)=>set("category",e.target.value)}><option value="">Choose category</option>{categories.map((c)=><option key={c}>{c}</option>)}</select></label>
            </div>
          </div>

          <div className={`overflow-hidden rounded-2xl border shadow-sm ${darkWriting ? "dark bg-[#101820] text-slate-100" : "bg-card"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <div className="flex flex-wrap items-center gap-1">
                <ToolbarButton label="Paragraph" active={editor?.isActive("paragraph")} onClick={()=>editor?.chain().focus().setParagraph().run()}><Pilcrow className="size-4"/></ToolbarButton>
                {[1,2,3,4].map(level=>{const Icon=level===1?Heading1:level===2?Heading2:Heading3;return <ToolbarButton key={level} label={`Heading ${level}`} active={editor?.isActive("heading",{level})} onClick={()=>editor?.chain().focus().toggleHeading({level}).run()}><Icon className="size-4"/></ToolbarButton>;})}
                <span className="mx-1 h-6 w-px bg-border"/>
                <ToolbarButton label="Bold" active={editor?.isActive("bold")} onClick={()=>editor?.chain().focus().toggleBold().run()}><Bold className="size-4"/></ToolbarButton>
                <ToolbarButton label="Italic" active={editor?.isActive("italic")} onClick={()=>editor?.chain().focus().toggleItalic().run()}><Italic className="size-4"/></ToolbarButton>
                <ToolbarButton label="Underline" active={editor?.isActive("underline")} onClick={()=>editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon className="size-4"/></ToolbarButton>
                <ToolbarButton label="Strikethrough" active={editor?.isActive("strike")} onClick={()=>editor?.chain().focus().toggleStrike().run()}><Strikethrough className="size-4"/></ToolbarButton>
                <span className="mx-1 h-6 w-px bg-border"/>
                <ToolbarButton label="Bullet list" active={editor?.isActive("bulletList")} onClick={()=>editor?.chain().focus().toggleBulletList().run()}><List className="size-4"/></ToolbarButton>
                <ToolbarButton label="Numbered list" active={editor?.isActive("orderedList")} onClick={()=>editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4"/></ToolbarButton>
                <ToolbarButton label="Quote" active={editor?.isActive("blockquote")} onClick={()=>editor?.chain().focus().toggleBlockquote().run()}><Quote className="size-4"/></ToolbarButton>
                <ToolbarButton label="Divider" onClick={insertDivider}><Minus className="size-4"/></ToolbarButton>
                <ToolbarButton label="Code block" active={editor?.isActive("codeBlock")} onClick={()=>editor?.chain().focus().toggleCodeBlock().run()}><Code className="size-4"/></ToolbarButton>
                <span className="mx-1 h-6 w-px bg-border"/>
                <ToolbarButton label="Insert link" active={editor?.isActive("link")} onClick={addLink}><Link2 className="size-4"/></ToolbarButton>
                <ToolbarButton label="Insert image" onClick={()=>bodyFileRef.current?.click()}><ImagePlus className="size-4"/></ToolbarButton>
                <ToolbarButton label="Insert table" onClick={insertTable}><Table2 className="size-4"/></ToolbarButton>
                <ToolbarButton label="Undo" disabled={!editor?.can().undo()} onClick={()=>editor?.chain().focus().undo().run()}><Undo2 className="size-4"/></ToolbarButton>
                <ToolbarButton label="Redo" disabled={!editor?.can().redo()} onClick={()=>editor?.chain().focus().redo().run()}><Redo2 className="size-4"/></ToolbarButton>
                <ToolbarButton label="Align left" onClick={()=>editor?.chain().focus().setTextAlign("left").run()}><AlignLeft className="size-4"/></ToolbarButton>
                <ToolbarButton label="Align center" onClick={()=>editor?.chain().focus().setTextAlign("center").run()}><AlignCenter className="size-4"/></ToolbarButton>
                <ToolbarButton label="Align right" onClick={()=>editor?.chain().focus().setTextAlign("right").run()}><AlignRight className="size-4"/></ToolbarButton>
              </div>
              <Button variant={preview?"default":"outline"} size="sm" onClick={()=>setPreview((x)=>!x)}><Eye className="mr-2 size-4"/>{preview?"Editor":"Preview"}</Button>
            </div>
            <input ref={bodyFileRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e)=>{insertImage(e.target.files?.[0]);e.currentTarget.value="";}}/>
            {preview ? <div className="prose-blog min-h-[560px] p-6"><MarkdownContent content={editor?.getHTML() ?? ""}/></div> : <EditorContent editor={editor} className="blog-tiptap-surface"/>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground"><span>{stats.words.toLocaleString()} words · {stats.reading} min read</span><span>{uploading?"Uploading image…":"Changes autosave to draft"}</span></div>
          </div>
          {editor?.isActive("image") && <div className="rounded-xl border bg-card p-4"><div className="mb-3 flex items-center justify-between"><p className="font-medium">Selected image</p><Button size="icon" variant="ghost" onClick={()=>editor.chain().focus().deleteSelection().run()}><X className="size-4"/></Button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Alt text<Input className="mt-1" value={imageAlt} onChange={e=>setImageAlt(e.target.value)}/></label><label className="text-xs text-muted-foreground">Caption / title<Input className="mt-1" value={captionText} onChange={e=>setCaptionText(e.target.value)}/></label></div><Button className="mt-3" size="sm" onClick={updateImageDetails}>Apply image details</Button></div>}
          {editor?.isActive("image") && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>editor.chain().focus().updateAttributes("image",{width:"50%"}).run()}>50% width</Button><Button size="sm" variant="outline" onClick={()=>editor.chain().focus().updateAttributes("image",{width:"75%"}).run()}>75% width</Button><Button size="sm" variant="outline" onClick={()=>editor.chain().focus().updateAttributes("image",{width:"100%"}).run()}>Full width</Button></div>}
          <div className="rounded-2xl border bg-card p-4 sm:p-6">
            <label className="block text-sm font-medium">Excerpt / summary</label><Textarea className="mt-2" rows={3} maxLength={300} value={v.excerpt??""} onChange={e=>set("excerpt",e.target.value)} placeholder="A concise description shown on article cards and in search snippets."/><p className="mt-1 text-right text-xs text-muted-foreground">{(v.excerpt??"").length}/300</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Video embed</p><Video className="size-4 text-muted-foreground"/></div><div className="flex flex-col gap-2 sm:flex-row"><Input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="Paste a YouTube URL"/><Button variant="outline" onClick={addVideo}>Embed video</Button></div>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="rounded-2xl border bg-card p-4 shadow-sm"><h2 className="font-semibold">Publishing</h2><p className="mt-1 text-xs text-muted-foreground">Choose draft, publish now, or schedule for later.</p>
            <label className="mt-4 block text-xs text-muted-foreground">Author name<Input className="mt-1" value={v.author_name??""} onChange={e=>set("author_name",e.target.value)}/></label>
            <label className="mt-3 block text-xs text-muted-foreground">Scheduled publish time<input type="datetime-local" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={v.scheduled_at?new Date(new Date(v.scheduled_at).getTime()-new Date(v.scheduled_at).getTimezoneOffset()*60000).toISOString().slice(0,16):""} onChange={e=>set("scheduled_at",e.target.value?new Date(e.target.value).toISOString():null)}/></label><label className="mt-4 block text-xs text-muted-foreground">Publish date<input type="datetime-local" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={v.published_at?new Date(new Date(v.published_at).getTime()-new Date(v.published_at).getTimezoneOffset()*60000).toISOString().slice(0,16):""} onChange={e=>set("published_at",e.target.value?new Date(e.target.value).toISOString():null)}/></label></div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm"><h2 className="font-semibold">Featured image</h2><button type="button" onClick={()=>coverFileRef.current?.click()} className="mt-3 grid aspect-video w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 text-sm text-muted-foreground hover:bg-muted">{v.cover_image?<img src={coverImageUrl(v.cover_image)} alt="Article cover preview" className="h-full w-full object-cover"/>:<span><ImagePlus className="mx-auto mb-2 size-6"/>Upload cover image</span>}</button><input ref={coverFileRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{void uploadCover(e.target.files?.[0]);e.currentTarget.value="";}}/><p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WebP or GIF · up to 5 MB</p><Button variant="ghost" size="sm" className="mt-1" onClick={()=>set("cover_image","")}>Remove cover</Button></div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm"><h2 className="font-semibold">Tags</h2><div className="mt-3 flex gap-2"><Input value={tagDraft} onChange={e=>setTagDraft(e.target.value)} placeholder="Add tag" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTag();}}}/><Button variant="outline" onClick={addTag}>Add</Button></div><div className="mt-3 flex flex-wrap gap-2">{(v.tags??[]).map(tag=><span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={()=>set("tags",(v.tags??[]).filter(x=>x!==tag))}>×</button></span>)}</div></div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm"><h2 className="font-semibold">Search appearance</h2><label className="mt-3 block text-xs text-muted-foreground">SEO title<Input className="mt-1" maxLength={70} value={v.meta_title??""} onChange={e=>set("meta_title",e.target.value)}/></label><label className="mt-3 block text-xs text-muted-foreground">Meta description<Textarea className="mt-1" maxLength={160} rows={3} value={v.meta_description??""} onChange={e=>set("meta_description",e.target.value)}/></label><label className="mt-3 block text-xs text-muted-foreground">Open Graph image URL<Input className="mt-1" value={v.og_image??""} onChange={e=>set("og_image",e.target.value)} placeholder="Optional image URL (defaults to cover)"/></label></div>
        </aside>
      </div>
    </div>
  );
}
