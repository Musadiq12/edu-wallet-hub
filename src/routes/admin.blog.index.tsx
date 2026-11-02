import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminPostsQuery, deletePost, type BlogFilter } from "@/lib/blog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/admin";

export const Route = createFileRoute("/admin/blog/")({
  head: () => ({ meta: [{ title: "Blog Manager — Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Page,
});

function Page() {
  const [filter, setFilter] = useState<BlogFilter>("all");
  const qc = useQueryClient();
  const query = useQuery(adminPostsQuery(filter));

  const setStatus = async (id: string, status: "draft" | "published") => {
    const { error } = await supabase.from("blog_posts").update({
      status,
      scheduled_at: null,
      published_at: status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(friendlyError(error));
    await qc.invalidateQueries({ queryKey: ["admin", "blog"] });
    await qc.invalidateQueries({ queryKey: ["blog"] });
    toast.success(status === "published" ? "Article published" : "Article moved to drafts");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this article permanently?")) return;
    try {
      await deletePost(id);
      await qc.invalidateQueries({ queryKey: ["admin", "blog"] });
      await qc.invalidateQueries({ queryKey: ["blog"] });
      toast.success("Article deleted");
    } catch (error) { toast.error(friendlyError(error)); }
  };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">EduWallet · Editorial</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Blog manager</h1><p className="mt-1 text-sm text-muted-foreground">Create, schedule and maintain your articles.</p></div>
      <Button asChild><Link to="/admin/blog/new">New article</Link></Button>
    </header>
    <div className="flex flex-wrap gap-2">{(["all","draft","scheduled","published"] as const).map(status=><Button key={status} size="sm" variant={filter===status?"default":"outline"} onClick={()=>setFilter(status)} className="capitalize">{status}</Button>)}</div>
    {query.isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted"/> :
      query.data?.length ? <div className="space-y-3">{query.data.map(post=><article key={post.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold">{post.title || "Untitled article"}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{post.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{post.category || "Uncategorised"} · /{post.slug}</p>{post.status==="scheduled"&&post.scheduled_at&&<p className="mt-1 text-xs text-primary">Scheduled for {new Date(post.scheduled_at).toLocaleString("en-IN")}</p>}</div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link to="/admin/blog/$id" params={{id:post.id}}>Edit</Link></Button>{post.status==="published"?<Button size="sm" variant="outline" onClick={()=>void setStatus(post.id,"draft")}>Unpublish</Button>:<Button size="sm" variant="outline" onClick={()=>void setStatus(post.id,"published")}>Publish now</Button>}<Button size="sm" variant="destructive" onClick={()=>void remove(post.id)}>Delete</Button></div>
      </article>)}</div> : <div className="rounded-xl border border-dashed p-10 text-center"><h2 className="font-semibold">No articles here</h2><p className="mt-1 text-sm text-muted-foreground">Create a new article or choose another filter.</p><Button className="mt-4" asChild><Link to="/admin/blog/new">Create article</Link></Button></div>}
  </div>;
}
