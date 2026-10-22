import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Plus, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminPostsQuery, deletePost, savePost, coverImageUrl, type BlogPostListItem } from "@/lib/blog";
import { friendlyError } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/blog/")({ head:()=>({meta:[{title:"Blog Manager — Admin"},{name:"robots",content:"noindex, nofollow"}]}),component:AdminBlog });

function date(value:string|null){return value?new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(new Date(value)):"—";}

function AdminBlog(){
  const qc=useQueryClient();
  const [tab,setTab]=useState<"all"|"draft"|"published">("all");
  const [target,setTarget]=useState<BlogPostListItem|null>(null);
  const [action,setAction]=useState<"delete"|"unpublish">("delete");
  const [busy,setBusy]=useState(false);
  const {data,isLoading,isError}=useQuery(adminPostsQuery(tab));
  const all=useQuery(adminPostsQuery("all"));
  const counts={all:all.data?.length??0,draft:all.data?.filter(p=>p.status==="draft").length??0,published:all.data?.filter(p=>p.status==="published").length??0};
  const run=async()=>{
    if(!target)return;setBusy(true);
    try{
      if(action==="delete")await deletePost(target.id);
      else await savePost({id:target.id,slug:target.slug,title:target.title,excerpt:target.excerpt,content:"",category:target.category,tags:target.tags,cover_image:target.cover_image,meta_title:target.meta_title,meta_description:target.meta_description,status:"draft",published_at:target.published_at});
      await qc.invalidateQueries({queryKey:["admin","blog-posts"]});await qc.invalidateQueries({queryKey:["blog"]});
      toast.success(action==="delete"?"Article deleted.":"Article unpublished.");
    }catch(e){toast.error(friendlyError(e,"Could not update this article."));}
    finally{setBusy(false);setTarget(null);}
  };
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Content</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Blog articles</h1><p className="mt-1 text-sm text-muted-foreground">Create, edit, publish and manage search-friendly articles.</p></div><Button asChild><Link to="/admin/blog/new"><Plus className="mr-2 h-4 w-4"/>New article</Link></Button></div>
    <div className="flex flex-wrap gap-2">{(["all","draft","published"] as const).map(key=><Button key={key} variant={tab===key?"default":"outline"} size="sm" onClick={()=>setTab(key)}>{key==="all"?"All":key==="draft"?"Drafts":"Published"} <span className="ml-1 opacity-70">{counts[key]}</span></Button>)}</div>
    {isLoading?<div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-20 w-full"/>)}</div>:isError?<p className="text-sm text-destructive">Articles could not be loaded. Refresh and try again.</p>:(data??[]).length===0?<div className="rounded-xl border border-dashed border-border p-10 text-center"><FileText className="mx-auto h-8 w-8 text-muted-foreground"/><h2 className="mt-3 font-semibold">No {tab==="all"?"articles":tab+" articles"} yet</h2><p className="mt-1 text-sm text-muted-foreground">Create an article to start building your search content.</p><Button asChild className="mt-4"><Link to="/admin/blog/new">Create article</Link></Button></div>:
      <div className="overflow-hidden rounded-xl border border-border"><div className="hidden grid-cols-[minmax(0,1fr)_130px_120px_145px] gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid"><span>Article</span><span>Category</span><span>Status</span><span>Actions</span></div>
      <div className="divide-y divide-border">{data!.map(post=><div key={post.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_130px_120px_145px] md:items-center md:gap-4">
        <div className="flex min-w-0 items-center gap-3"><div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">{post.cover_image?<img src={coverImageUrl(post.cover_image)} alt="" className="h-full w-full object-cover"/>:<div className="h-full w-full"/>}</div><div className="min-w-0"><p className="truncate font-semibold">{post.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</p><p className="mt-1 text-xs text-muted-foreground md:hidden">{post.category||"Uncategorized"} · {date(post.published_at)}</p></div></div>
        <div className="hidden truncate text-sm text-muted-foreground md:block">{post.category||"—"}</div><div><Badge variant={post.status==="published"?"default":"secondary"}>{post.status==="published"?"Published":"Draft"}</Badge><p className="mt-1 text-xs text-muted-foreground">{date(post.published_at)}</p></div>
        <div className="flex flex-wrap gap-1.5"><Button asChild size="icon" variant="outline" aria-label="Edit article"><Link to="/admin/blog/$id" params={{id:post.id}}><Pencil className="h-4 w-4"/></Link></Button>{post.status==="published"?<Button size="icon" variant="outline" aria-label="Unpublish article" onClick={()=>{setTarget(post);setAction("unpublish");}}><EyeOff className="h-4 w-4"/></Button>:<Button size="icon" variant="outline" aria-label="Publish article" onClick={async()=>{try{await savePost({id:post.id,slug:post.slug,title:post.title,excerpt:post.excerpt,content:"",category:post.category,tags:post.tags,cover_image:post.cover_image,meta_title:post.meta_title,meta_description:post.meta_description,status:"published",published_at:post.published_at});await qc.invalidateQueries({queryKey:["admin","blog-posts"]});await qc.invalidateQueries({queryKey:["blog"]});toast.success("Article published.");}catch(e){toast.error(friendlyError(e,"Could not publish article."));}}}><Eye className="h-4 w-4"/></Button>}<Button size="icon" variant="outline" aria-label="Delete article" onClick={()=>{setTarget(post);setAction("delete");}}><Trash2 className="h-4 w-4"/></Button></div>
      </div>)}</div></div>}
    <AlertDialog open={!!target} onOpenChange={open=>{if(!open&&!busy)setTarget(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{action==="delete"?"Delete this article?":"Unpublish this article?"}</AlertDialogTitle><AlertDialogDescription>{action==="delete"?"This permanently deletes the article.":"This removes the article from the public site and sitemap."} {target?.title}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void run();}}>{busy?"Working…":action==="delete"?"Delete article":"Unpublish"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
