import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LIMITS, uploadFile, removeFile, friendlyError } from "@/lib/admin";
import { coverImageUrl, savePost, uniqueSlugCheck, type BlogPost, type BlogPostInput } from "@/lib/blog";

type FormState = {
  title: string; slug: string; excerpt: string; content: string; category: string;
  tags: string; cover_image: string; meta_title: string; meta_description: string;
};
const EMPTY: FormState = { title:"", slug:"", excerpt:"", content:"", category:"", tags:"", cover_image:"", meta_title:"", meta_description:"" };
const slugify = (value: string) => value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");

export function BlogPostForm({ post }: { post?: BlogPost }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(post ? {
    title:post.title, slug:post.slug, excerpt:post.excerpt, content:post.content, category:post.category,
    tags:post.tags.join(", "), cover_image:post.cover_image, meta_title:post.meta_title, meta_description:post.meta_description,
  } : EMPTY);
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [coverPath, setCoverPath] = useState(post?.cover_image ?? "");
  const [previousCover] = useState(post?.cover_image ?? "");
  const slugCheck = useQuery({
    queryKey: ["admin","blog-slug-check",form.slug,post?.id ?? null],
    enabled: !!form.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug),
    queryFn: () => uniqueSlugCheck(form.slug, post?.id),
    staleTime: 0,
  });
  useEffect(() => { setSlugAvailable(slugCheck.data ?? null); }, [slugCheck.data]);
  useEffect(() => {
    if (!coverFile) {
      setCoverPreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [coverFile]);
  const cover = coverRemoved ? "" : coverPreview || coverImageUrl(coverPath);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({...current,[key]:value}));
  const statusLabel = useMemo(() => post?.status === "published" ? "published" : "draft", [post?.status]);

  const handleCover = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
    if (file.size > LIMITS.coverBytes) { toast.error("Cover images must be 5 MB or smaller."); return; }
    setCoverFile(file); setCoverRemoved(false);
  };

  const save = async (status: "draft" | "published") => {
    if (!form.title.trim() || !form.slug.trim() || !form.excerpt.trim() || !form.content.trim()) {
      toast.error("Title, slug, excerpt and content are required."); return;
    }
    if (form.excerpt.length > 300 || form.meta_title.length > 70 || form.meta_description.length > 160) {
      toast.error("One or more fields exceed their character limit."); return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) { toast.error("Use a lowercase URL slug with letters, numbers and hyphens."); return; }
    if (slugAvailable === false) { toast.error("This slug is already used."); return; }
    setBusy(true);
    let uploadedPath = "";
    try {
      let savedCoverPath = coverRemoved ? "" : coverPath;
      if (coverFile) {
        setUploading(true);
        const upload = await uploadFile("blog-covers", coverFile, "blog");
        uploadedPath = upload.path;
        savedCoverPath = upload.path;
      }
      const input: BlogPostInput = {
        ...(post ? {id:post.id} : {}),
        title: form.title.trim(), slug: form.slug, excerpt: form.excerpt.trim(), content: form.content,
        category: form.category.trim(), tags: form.tags.split(",").map(tag => tag.trim()).filter(Boolean),
        cover_image: savedCoverPath, meta_title: form.meta_title.trim(), meta_description: form.meta_description.trim(),
        status, published_at: post?.published_at ?? null,
      };
      await savePost(input);
      if (previousCover && (coverRemoved || (uploadedPath && previousCover !== uploadedPath))) await removeFile("blog-covers", previousCover);
      setCoverPath(savedCoverPath);
      set("cover_image", savedCoverPath);
      setCoverFile(null);
      setCoverRemoved(false);
      await Promise.all([
        qc.invalidateQueries({queryKey:["blog"]}),
        qc.invalidateQueries({queryKey:["admin","blog-posts"]}),
        qc.invalidateQueries({queryKey:["admin","blog-post",post?.id]}),
      ]);
      toast.success(status === "published" ? "Article published." : "Draft saved.");
      void navigate({to:"/admin/blog"});
    } catch (error) {
      if (uploadedPath) await removeFile("blog-covers", uploadedPath);
      toast.error(friendlyError(error, error instanceof Error ? error.message : "Could not save article."));
    } finally { setBusy(false); setUploading(false); }
  };

  return <form className="space-y-7" onSubmit={e=>{e.preventDefault();void save("draft");}}>
    <section className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="blog-title">Title *</Label><Input id="blog-title" value={form.title} required maxLength={200} onChange={e=>{set("title",e.target.value);if(!slugTouched)set("slug",slugify(e.target.value));}} /></div>
      <div className="space-y-1.5"><Label htmlFor="blog-slug">Slug *</Label><Input id="blog-slug" value={form.slug} required onChange={e=>{setSlugTouched(true);set("slug",slugify(e.target.value));}} aria-invalid={slugAvailable===false}/><p className={`text-xs ${slugAvailable===false ? "text-destructive" : "text-muted-foreground"}`}>{slugAvailable===false ? "This slug is already used." : slugCheck.isFetching ? "Checking slug…" : `Public URL: /blog/${form.slug || "your-article-slug"}`}</p></div>
      <div className="space-y-1.5"><Label htmlFor="blog-category">Category</Label><Input id="blog-category" list="blog-categories" value={form.category} onChange={e=>set("category",e.target.value)} placeholder="NEET, JEE, UPSC, Study Tips…"/><datalist id="blog-categories">{["NEET","JEE","UPSC","SSC CGL","Banking","CLAT","Study Tips"].map(x=><option key={x} value={x}/>)}</datalist></div>
      <div className="space-y-1.5"><Label htmlFor="blog-tags">Tags</Label><Input id="blog-tags" value={form.tags} onChange={e=>set("tags",e.target.value)} placeholder="revision, timetable, mock tests"/></div>
      <div className="space-y-1.5"><Label htmlFor="blog-excerpt">Excerpt * ({form.excerpt.length}/300)</Label><Textarea id="blog-excerpt" rows={3} required maxLength={300} value={form.excerpt} onChange={e=>set("excerpt",e.target.value)}/></div>
    </section>
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3"><Label htmlFor="blog-content">Markdown content *</Label><div className="flex gap-2"><Button type="button" variant={!preview?"default":"outline"} size="sm" onClick={()=>setPreview(false)}>Write</Button><Button type="button" variant={preview?"default":"outline"} size="sm" onClick={()=>setPreview(true)}>Preview</Button></div></div>
      {preview ? <div className="prose-blog min-h-60 rounded-lg border border-border p-4 leading-7"><ReactMarkdown>{form.content}</ReactMarkdown></div> : <Textarea id="blog-content" className="min-h-80 font-mono text-sm" required value={form.content} onChange={e=>set("content",e.target.value)} placeholder={"## Start here\n\nWrite the article in Markdown…"} />}
    </section>
    <section className="space-y-3">
      <Label htmlFor="blog-cover">Cover image (max 5 MB)</Label>
      {cover && <div className="relative max-w-lg overflow-hidden rounded-lg border border-border"><img src={cover} alt="Article cover preview" className="aspect-video w-full object-cover"/><Button type="button" size="icon" variant="destructive" className="absolute right-2 top-2" aria-label="Remove cover" onClick={()=>{setCoverFile(null);setCoverPath("");set("cover_image","");setCoverRemoved(true);}}><X className="h-4 w-4"/></Button></div>}
      <div className="flex items-center gap-3"><Input id="blog-cover" type="file" accept="image/*" disabled={uploading||busy} onChange={e=>handleCover(e.target.files?.[0])}/><Upload className="h-4 w-4 shrink-0 text-muted-foreground"/></div>
      {uploading && <p className="text-xs text-muted-foreground">Uploading cover image…</p>}
    </section>
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Search engine metadata</h2>
      <div className="space-y-1.5"><Label htmlFor="blog-meta-title">Meta title ({form.meta_title.length}/70)</Label><Input id="blog-meta-title" maxLength={70} value={form.meta_title} onChange={e=>set("meta_title",e.target.value)}/></div>
      <div className="space-y-1.5"><Label htmlFor="blog-meta-description">Meta description ({form.meta_description.length}/160)</Label><Textarea id="blog-meta-description" maxLength={160} rows={3} value={form.meta_description} onChange={e=>set("meta_description",e.target.value)}/></div>
    </section>
    <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background/95 py-4 backdrop-blur sm:flex-row sm:items-center">
      <Badge variant="outline">Current: {statusLabel}</Badge>
      <div className="flex flex-1 gap-2 sm:justify-end">
        <Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={busy||slugAvailable===false} onClick={()=>void save("draft")}>{busy?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving…</>:"Save draft"}</Button>
        <Button type="button" className="flex-1 sm:flex-none" disabled={busy||slugAvailable===false} onClick={()=>void save("published")}>{busy?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving…</>:"Save & publish"}</Button>
      </div>
    </div>
  </form>;
}
