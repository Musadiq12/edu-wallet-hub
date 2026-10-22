import { createFileRoute, Link } from "@tanstack/react-router";
import { BlogPostForm } from "@/components/admin/BlogPostForm";

export const Route = createFileRoute("/admin/blog/new")({ component: NewBlogPost });

function NewBlogPost() {
  return <div className="space-y-6">
    <div>
      <Link to="/admin/blog" className="text-sm text-primary hover:underline">← Back to blog articles</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">New article</h1>
      <p className="mt-1 text-sm text-muted-foreground">Save as a draft or publish the article to the public blog.</p>
    </div>
    <BlogPostForm />
  </div>;
}
