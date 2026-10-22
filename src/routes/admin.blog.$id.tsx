import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { adminPostQuery } from "@/lib/blog";

export const Route = createFileRoute("/admin/blog/$id")({ component: EditBlogPost });

function EditBlogPost() {
  const { id } = Route.useParams();
  const { data, isLoading, isError } = useQuery(adminPostQuery(id));

  return <div className="space-y-6">
    <div>
      <Link to="/admin/blog" className="text-sm text-primary hover:underline">← Back to blog articles</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit article</h1>
    </div>
    {isLoading ? <div className="space-y-3">{Array.from({length:7}).map((_,i)=><Skeleton key={i} className="h-11 w-full"/>)}</div>
      : isError ? <p className="text-sm text-destructive">We could not load this article. Please try again.</p>
      : !data ? <p className="text-sm text-muted-foreground">This article no longer exists.</p>
      : <BlogPostForm key={data.id} post={data}/>}
  </div>;
}
