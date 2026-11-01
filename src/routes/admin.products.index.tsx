import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Eye, ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adminProductsQuery, friendlyError, type AdminProduct } from "@/lib/admin";
import { categoriesQuery } from "@/lib/catalog";
import { effectivePrice, formatPrice, hasDiscount } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { listSellerProductReviews, reviewSellerProduct } from "@/lib/seller-product-review.server-fns";

type SellerProduct = {
  id: string;
  title: string;
  slug: string;
  product_type: "pdf" | "physical";
  course_label: string | null;
  subject_label: string | null;
  price: number | string;
  discounted_price: number | string | null;
  is_free: boolean;
  is_featured: boolean;
  is_active: boolean;
  is_archived: boolean;
  status: "published" | "unpublished";
  seller_id: string;
  created_at: string;
  category_id: string | null;
};

type ManagedProduct = (AdminProduct | SellerProduct) & { owner_type: "staff" | "seller" };

export const Route = createFileRoute("/admin/products/")({ component: AdminProducts });

function AdminProducts() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const staffQuery = useQuery(adminProductsQuery(showArchived));
  const { data: categories } = useQuery(categoriesQuery());
  const [target, setTarget] = useState<ManagedProduct | null>(null);
  const [dialogAction, setDialogAction] = useState<"archive" | "delete">("archive");
  const [sellerAction, setSellerAction] = useState<"unpublish" | "republish">("unpublish");
  const [busyId, setBusyId] = useState<string | null>(null);
  const mutationLockRef = useRef(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "price">("newest");

  const sellerQuery = useQuery({
    queryKey: ["admin", "products", "approved-seller-listings"],
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.access_token) throw new Error("Please sign in again.");
      return listSellerProductReviews({ data: { accessToken: session.access_token, status: "published" } }) as unknown as Promise<SellerProduct[]>;
    },
    staleTime: 30000,
  });

  const products = useMemo<ManagedProduct[]>(() => [
    ...(staffQuery.data ?? []).map((product) => ({ ...product, owner_type: "staff" as const })),
    ...(sellerQuery.data ?? []).map((product) => ({ ...product, owner_type: "seller" as const })),
  ], [staffQuery.data, sellerQuery.data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...products].filter((product) => {
      const matches = !term || [product.title, product.slug, product.course_label, product.subject_label]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      const archived = product.owner_type === "staff" && product.is_archived;
      const published = product.owner_type === "seller" ? product.status === "published" : product.is_active && !archived;
      const draft = product.owner_type === "staff" && !product.is_active && !archived;
      const matchesStatus = status === "all"
        || (status === "published" && published)
        || (status === "draft" && draft)
        || (status === "archived" && archived)
        || (status === "free" && product.is_free);
      return matches && matchesStatus;
    }).sort((a, b) => sort === "price"
      ? Number(b.discounted_price ?? b.price) - Number(a.discounted_price ?? a.price)
      : sort === "oldest"
        ? +new Date(a.created_at) - +new Date(b.created_at)
        : +new Date(b.created_at) - +new Date(a.created_at));
  }, [products, search, status, sort]);

  const categoryName = (id: string | null) => categories?.find((category) => category.id === id)?.name ?? "—";

  const setPublished = async (product: ManagedProduct, value: boolean) => {
    if (product.owner_type === "seller") {
      setSellerAction(value ? "republish" : "unpublish");
      setTarget(product);
      return;
    }
    if (mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusyId(product.id);
    try {
      const { error } = await supabase.from("products").update({ is_active: value }).eq("id", product.id).is("seller_id", null);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["admin"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(value ? "Product published." : "Product unpublished.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not update the product."));
    } finally {
      setBusyId(null);
      mutationLockRef.current = false;
    }
  };

  const archive = async (product: ManagedProduct) => {
    if (product.owner_type !== "staff" || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusyId(product.id);
    try {
      const { error } = await supabase.from("products").update({ is_archived: true, is_active: false }).eq("id", product.id).is("seller_id", null);
      if (error) throw error;
      setTarget(null);
      await qc.invalidateQueries({ queryKey: ["admin"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product archived. Existing orders keep their records.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not archive the product."));
    } finally {
      setBusyId(null);
      mutationLockRef.current = false;
    }
  };

  const permanentlyDelete = async (product: ManagedProduct) => {
    if (product.owner_type !== "staff" || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusyId(product.id);
    try {
      const { count, error: ordersError } = await supabase.from("orders")
        .select("id", { count: "exact", head: true }).eq("product_id", product.id);
      if (ordersError) throw ordersError;
      if ((count ?? 0) > 0) {
        toast.error("This product has order history. Archive it instead to preserve customer records.");
        setTarget(null);
        return;
      }
      const { error } = await supabase.from("products").delete().eq("id", product.id).is("seller_id", null);
      if (error) throw error;
      setTarget(null);
      await qc.invalidateQueries({ queryKey: ["admin"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product permanently deleted. Stored files were left untouched.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not permanently delete the product."));
    } finally {
      setBusyId(null);
      mutationLockRef.current = false;
    }
  };

  const restore = async (product: ManagedProduct) => {
    if (product.owner_type !== "staff" || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusyId(product.id);
    try {
      const { error } = await supabase.from("products").update({ is_archived: false }).eq("id", product.id).is("seller_id", null);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Product restored as a draft.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not restore the product."));
    } finally {
      setBusyId(null);
      mutationLockRef.current = false;
    }
  };

  const updateSellerProduct = async () => {
    if (!target || target.owner_type !== "seller" || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setBusyId(target.id);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.access_token) throw new Error("Please sign in again.");
      await reviewSellerProduct({ data: { accessToken: session.access_token, id: target.id, action: sellerAction } });
      const productId = target.id;
      setTarget(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "products"] }),
        qc.invalidateQueries({ queryKey: ["admin", "seller-product-review"] }),
        qc.invalidateQueries({ queryKey: ["admin", "seller-product-review-detail", productId] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
      ]);
      toast.success(sellerAction === "unpublish" ? "Seller listing taken down." : "Seller listing republished.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not update this seller listing."));
    } finally {
      setBusyId(null);
      mutationLockRef.current = false;
    }
  };

  const isLoading = staffQuery.isLoading || sellerQuery.isLoading;
  const isError = staffQuery.isError || sellerQuery.isError;
  const refetch = () => Promise.all([staffQuery.refetch(), sellerQuery.refetch()]);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage EduWallet products and approved seller listings in one catalogue.</p>
        </div>
        <Button asChild className="h-11">
          <Link to="/admin/products/new"><Plus className="mr-2 h-4 w-4" /> Add Product</Link>
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
        Include archived products
      </label>

      <div className="grid min-w-0 gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, course or subject" aria-label="Search products" className="h-10 min-w-0 bg-background" />
        <select value={status} onChange={(event) => { setStatus(event.target.value); if (event.target.value === "archived") setShowArchived(true); }} aria-label="Filter products" className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All products</option><option value="published">Published</option><option value="draft">Drafts</option><option value="free">Free</option><option value="archived">Archived</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort products" className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="price">Highest price</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          <p>We could not load your products right now. Please try again.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>Retry</Button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No products yet. Add your first resource to get started.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No products match your filters.</div>
      ) : (
        <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-3 py-3 font-medium">Format</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const sellerOwned = product.owner_type === "seller";
                const archived = !sellerOwned && product.is_archived;
                const active = sellerOwned ? product.status === "published" : product.is_active;
                return (
                  <tr key={product.id} className="border-t border-border align-middle">
                    <td className="max-w-[18rem] px-4 py-3">
                      <p className="truncate font-medium">{product.title}</p>
                      <p className="truncate text-xs text-muted-foreground">/shop/{product.slug}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{[categoryName(product.category_id), product.course_label, product.subject_label].filter(Boolean).join(" · ") || "Uncategorised"}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{product.product_type === "physical" ? "Physical copy" : "Digital PDF"}</td>
                    <td className="px-4 py-3">
                      {product.is_free ? "Free" : hasDiscount(Number(product.price), product.discounted_price != null ? Number(product.discounted_price) : null)
                        ? <span><span className="text-muted-foreground line-through">{formatPrice(Number(product.price))}</span>{" "}{formatPrice(Number(product.discounted_price))}</span>
                        : formatPrice(effectivePrice(product))}
                    </td>
                    <td className="px-4 py-3">
                      {archived ? <Badge variant="outline">Archived</Badge> : active ? <Badge>Published</Badge> : <Badge variant="secondary">{sellerOwned ? "Taken down" : "Draft"}</Badge>}
                    </td>
                    <td className="px-4 py-3">{sellerOwned ? <Badge variant="outline">Seller</Badge> : <Badge variant="secondary">EduWallet</Badge>}</td>
                    <td className="whitespace-nowrap px-4 py-3">{new Date(product.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {busyId === product.id && <Loader2 className="mr-1 h-4 w-4 animate-spin self-center" />}
                        {sellerOwned ? (
                          <>
                            <Button size="sm" variant="outline" disabled={busyId === product.id} onClick={() => void setPublished(product, !active)}>{active ? "Take down" : "Republish"}</Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={busyId === product.id}>Manage</Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild><Link to="/shop/$slug" params={{ slug: product.slug }} target="_blank"><Eye className="h-4 w-4" />View listing</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link to="/admin/seller-products"><ExternalLink className="h-4 w-4" />Open moderation</Link></DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        ) : archived ? (
                          <Button size="sm" variant="outline" disabled={busyId === product.id} onClick={() => void restore(product)}>Restore</Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" disabled={busyId === product.id} onClick={() => void setPublished(product, !active)}>{active ? "Unpublish" : "Publish"}</Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={busyId === product.id}>Manage</Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild><Link to="/shop/$slug" params={{ slug: product.slug }} target="_blank"><Eye className="h-4 w-4" />View product</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link to="/admin/products/$id" params={{ id: product.id }}><Pencil className="h-4 w-4" />Edit product</Link></DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => { setTarget(product); setDialogAction("archive"); }}><Archive className="h-4 w-4" />Archive product</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => { setTarget(product); setDialogAction("delete"); }}><Trash2 className="h-4 w-4" />Delete permanently</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!target && target.owner_type === "staff"} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogAction === "archive" ? "Archive this product?" : "Permanently delete this product?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === "archive" ? `“${target?.title}” will be hidden from the public Shop. Product and order history will be preserved.` : `“${target?.title}” will be permanently removed. Products with order history cannot be deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => target && void (dialogAction === "archive" ? archive(target) : permanentlyDelete(target))}>
              {dialogAction === "archive" ? "Archive product" : "Permanently delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!target && target.owner_type === "seller"} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{sellerAction === "unpublish" ? "Take down this seller listing?" : "Republish this seller listing?"}</AlertDialogTitle>
            <AlertDialogDescription>The action uses seller-product moderation, preserves seller ownership, and notifies the seller.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === target?.id}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busyId === target?.id} onClick={(event) => { event.preventDefault(); void updateSellerProduct(); }}>
              {sellerAction === "unpublish" ? "Take down listing" : "Republish listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
