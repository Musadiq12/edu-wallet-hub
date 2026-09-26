import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminProductsQuery, friendlyError } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/free-resources")({ component: AdminFreeResources });

function AdminFreeResources() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery(adminProductsQuery(false));
  const free = (data ?? []).filter((p) => p.is_free);

  const toggle = async (id: string, value: boolean) => {
    const { error } = await supabase.from("products").update({ is_active: value }).eq("id", id);
    if (error) return void toast.error(friendlyError(error, "Could not update this resource."));
    await qc.invalidateQueries({ queryKey: ["admin"] });
    await qc.invalidateQueries({ queryKey: ["products"] });
    toast.success(value ? "Resource published." : "Resource unpublished.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Free Resources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Products marked as free. They appear on the public Free Resources page once published.
          </p>
        </div>
        <Button asChild className="h-11"><Link to="/admin/products/new">Add product</Link></Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm"><p>We could not load free resources right now. Please try again.</p><Button size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>Retry</Button></div>
      ) : free.length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No free resources yet. Create a product and turn on the “Free product” toggle.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {free.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.subject_label ?? "—"} · {p.preview_file ? "Sample file attached" : "No sample file"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Published" : "Draft"}</Badge>
                <Button size="sm" variant="outline" onClick={() => void toggle(p.id, !p.is_active)}>
                  {p.is_active ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/admin/products/$id" params={{ id: p.id }}>Edit</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
