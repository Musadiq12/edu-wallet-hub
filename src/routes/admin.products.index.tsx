import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminProductsQuery, friendlyError, type AdminProduct } from "@/lib/admin";
import { categoriesQuery } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/products/")({ component: AdminProducts });

function AdminProducts() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading, isError } = useQuery(adminProductsQuery(showArchived));
  const { data: categories } = useQuery(categoriesQuery());
  const [target, setTarget] = useState<AdminProduct | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const categoryName = (id: string | null) => categories?.find((c) => c.id === id)?.name ?? "—";

  const setPublished = async (p: AdminProduct, value: boolean) => {
    setBusyId(p.id);
    const { error } = await supabase.from("products").update({ is_active: value }).eq("id", p.id);
    setBusyId(null);
    if (error) return void toast.error(friendlyError(error, "Could not update the product."));
    await qc.invalidateQueries({ queryKey: ["admin"] });
    await qc.invalidateQueries({ queryKey: ["products"] });
    toast.success(value ? "Product published." : "Product unpublished.");
  };

  const archive = async (p: AdminProduct) => {
    setBusyId(p.id);
    const { error } = await supabase.from("products").update({ is_archived: true, is_active: false }).eq("id", p.id);
    setBusyId(null);
    setTarget(null);
    if (error) return void toast.error(friendlyError(error, "Could not archive the product."));
    await qc.invalidateQueries({ queryKey: ["admin"] });
    await qc.invalidateQueries({ queryKey: ["products"] });
    toast.success("Product archived. Existing orders keep their records.");
  };

  const restore = async (p: AdminProduct) => {
    setBusyId(p.id);
    const { error } = await supabase.from("products").update({ is_archived: false }).eq("id", p.id);
    setBusyId(null);
    if (error) return void toast.error(friendlyError(error, "Could not restore the product."));
    await qc.invalidateQueries({ queryKey: ["admin"] });
    toast.success("Product restored as a draft.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, publish and manage your study resources.</p>
        </div>
        <Button asChild className="h-11">
          <Link to="/admin/products/new"><Plus className="mr-2 h-4 w-4" /> Add Product</Link>
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Include archived products
      </label>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : isError ? (
        <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          We could not load your products right now. Please refresh and try again.
        </p>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No products yet. Add your first resource to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Course</th>
                <th className="px-4 py-2.5 font-medium">Subject</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Featured</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border align-middle">
                  <td className="max-w-[18rem] px-4 py-3">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">/shop/{p.slug}</p>
                  </td>
                  <td className="px-4 py-3">{categoryName(p.category_id)}</td>
                  <td className="px-4 py-3">{p.course_label ?? "—"}</td>
                  <td className="px-4 py-3">{p.subject_label ?? "—"}</td>
                  <td className="px-4 py-3">
                    {p.is_free ? (
                      "Free"
                    ) : p.discounted_price ? (
                      <span>
                        <span className="line-through text-muted-foreground">{formatPrice(Number(p.price))}</span>{" "}
                        {formatPrice(Number(p.discounted_price))}
                      </span>
                    ) : (
                      formatPrice(Number(p.price))
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.is_archived ? (
                      <Badge variant="outline">Archived</Badge>
                    ) : p.is_active ? (
                      <Badge>Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.is_featured ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {busyId === p.id && <Loader2 className="mr-1 h-4 w-4 animate-spin self-center" />}
                      {p.is_archived ? (
                        <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => void restore(p)}>Restore</Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => void setPublished(p, !p.is_active)}>
                            {p.is_active ? "Unpublish" : "Publish"}
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="View product" asChild>
                            <Link to="/shop/$slug" params={{ slug: p.slug }} target="_blank"><Eye className="h-4 w-4" /></Link>
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Edit product" asChild>
                            <Link to="/admin/products/$id" params={{ id: p.id }}><Pencil className="h-4 w-4" /></Link>
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Delete product" onClick={() => setTarget(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              “{target?.title}” will be archived: it disappears from the public Shop and from this list, while its files
              and all past order records are kept intact. You can restore it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => target && void archive(target)}>Delete product</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
