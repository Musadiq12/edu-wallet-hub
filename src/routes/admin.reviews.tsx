import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Star, Trash2, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { friendlyError } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/auth";
import { BRAND, buildTitle } from "@/lib/seo";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({ meta: [{ title: buildTitle(["Reviews", "Admin", BRAND]) }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminReviews,
});

type Status = "pending" | "approved" | "rejected";
type AdminReview = {
  id: string; product_id: string; user_id: string; rating: number; title: string; comment: string;
  status: Status; is_sample: boolean; created_at: string; product_title: string; display_name: string;
};
type ProductOption = { id: string; title: string };

const reviewsQuery = () => ({
  queryKey: ["admin", "reviews"] as const,
  queryFn: async (): Promise<AdminReview[]> => {
    const { data, error } = await supabase.from("reviews")
      .select("id,product_id,user_id,rating,title,comment,status,is_sample,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const productIds = [...new Set(rows.map((row) => row.product_id))];
    const userIds = [...new Set(rows.filter((row) => !row.is_sample).map((row) => row.user_id))];
    const [{ data: products, error: productsError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from("products").select("id,title").in("id", productIds),
      userIds.length ? supabase.from("profiles").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsError) throw productsError;
    const productTitles = new Map((products ?? []).map((product) => [product.id, product.title]));
    const displayNames = new Map((profilesError ? [] : profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    return rows.map((row) => ({
      ...row,
      product_title: productTitles.get(row.product_id) || "Deleted product",
      display_name: row.is_sample ? "Sample review" : displayNames.get(row.user_id) || "Student",
    })) as AdminReview[];
  },
});

const productsQuery = () => ({
  queryKey: ["admin", "review-products"] as const,
  queryFn: async (): Promise<ProductOption[]> => {
    const { data, error } = await supabase.from("products").select("id,title").order("title");
    if (error) throw error;
    return data ?? [];
  },
});

function AdminReviews() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);
  const reviews = useQuery({ ...reviewsQuery(), enabled: !!user && !!isAdmin });
  const products = useQuery({ ...productsQuery(), enabled: !!user && !!isAdmin });
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "delete">("approve");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [sampleRating, setSampleRating] = useState("5");
  const [sampleTitle, setSampleTitle] = useState("");
  const [sampleComment, setSampleComment] = useState("");
  const [sampleSaving, setSampleSaving] = useState(false);

  const counts = useMemo(() => {
    const rows = reviews.data ?? [];
    return { pending: rows.filter((r) => !r.is_sample && r.status === "pending").length,
      approved: rows.filter((r) => !r.is_sample && r.status === "approved").length,
      rejected: rows.filter((r) => !r.is_sample && r.status === "rejected").length, all: rows.length };
  }, [reviews.data]);
  const visible = (reviews.data ?? []).filter((r) => filter === "all" || (!r.is_sample && r.status === filter));

  const addSampleReview = async () => {
    if (!productId || !sampleComment.trim()) {
      toast.error("Choose a product and write sample review text.");
      return;
    }
    const rating = Number(sampleRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || sampleTitle.trim().length > 100 || sampleComment.trim().length > 1000) {
      toast.error("Use a 1–5 rating, title under 100 characters, and comment under 1000 characters.");
      return;
    }
    setSampleSaving(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        product_id: productId, user_id: user!.id, rating, title: sampleTitle.trim(), comment: sampleComment.trim(),
        status: "approved", is_sample: true,
      });
      if (error) throw error;
      setSampleTitle(""); setSampleComment(""); setSampleRating("5");
      await qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      await qc.invalidateQueries({ queryKey: ["reviews", productId] });
      await qc.invalidateQueries({ queryKey: ["review-summary", productId] });
      toast.success("Sample review added.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not add the sample review."));
    } finally {
      setSampleSaving(false);
    }
  };

  const mutateReview = async () => {
    if (!target) return;
    setBusyId(target.id);
    try {
      if (action === "delete") {
        const { error } = await supabase.from("reviews").delete().eq("id", target.id);
        if (error) throw error;
      } else {
        if (target.is_sample) throw new Error("Sample reviews can only be deleted, not approved or rejected.");
        const status: Status = action === "approve" ? "approved" : "rejected";
        const { error } = await supabase.from("reviews").update({ status, updated_at: new Date().toISOString() }).eq("id", target.id).eq("is_sample", false);
        if (error) throw error;
      }
      setTarget(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "reviews"] }),
        qc.invalidateQueries({ queryKey: ["reviews", target.product_id] }),
        qc.invalidateQueries({ queryKey: ["review-summary", target.product_id] }),
        qc.invalidateQueries({ queryKey: ["my-review", target.product_id, target.user_id] }),
      ]);
      toast.success(action === "delete" ? (target.is_sample ? "Sample review deleted." : "Review deleted.") : action === "approve" ? "Review approved." : "Review rejected.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not update this review."));
    } finally {
      setBusyId(null);
    }
  };

  if (roleLoading) return <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (!user || !isAdmin) return <div className="rounded-xl border border-border p-6"><h1 className="text-xl font-semibold">Access denied</h1><p className="mt-2 text-sm text-muted-foreground">This area is restricted to administrators.</p></div>;

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Ratings & Reviews</h1><p className="mt-1 text-sm text-muted-foreground">Verified customer feedback and clearly marked sample reviews.</p></div>
    <section className="space-y-3 rounded-xl border border-border p-4 sm:p-5">
      <div><h2 className="font-semibold">Add sample review</h2><p className="text-sm text-muted-foreground">Sample reviews are labeled on the storefront and excluded from real customer averages.</p></div>
      {products.isError ? <p className="text-sm text-destructive">Could not load products. {friendlyError(products.error)}</p> : <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Product
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Choose a product</option>{(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">Rating
          <select value={sampleRating} onChange={(e) => setSampleRating(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} star{n===1?"":"s"}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium sm:col-span-2">Title (optional)
          <Input value={sampleTitle} maxLength={100} onChange={(e) => setSampleTitle(e.target.value)} placeholder="Example: Helpful for quick revision" />
        </label>
        <label className="space-y-1 text-sm font-medium sm:col-span-2">Comment
          <Textarea value={sampleComment} maxLength={1000} rows={3} onChange={(e) => setSampleComment(e.target.value)} placeholder="Write an illustrative positive or critical sample review" />
        </label>
        <div className="sm:col-span-2"><Button disabled={sampleSaving || products.isLoading || !productId || !sampleComment.trim()} onClick={() => void addSampleReview()}><Plus className="mr-2 h-4 w-4" />{sampleSaving ? "Adding…" : "Add sample review"}</Button></div>
      </div>}
    </section>
    <div className="flex flex-wrap gap-2">
      {(["pending", "approved", "rejected", "all"] as const).map((status) => <Button key={status} size="sm" variant={filter === status ? "default" : "outline"} onClick={() => setFilter(status)} className="capitalize">{status} <span className="ml-1 tabular-nums">{counts[status]}</span></Button>)}
    </div>
    {reviews.isLoading ? <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div> :
      reviews.isError ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm">Could not load reviews. {friendlyError(reviews.error)} <Button size="sm" variant="outline" className="ml-2" onClick={() => void reviews.refetch()}>Retry</Button></div> :
      visible.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No {filter === "all" ? "" : filter} reviews.</div> :
      <div className="space-y-3">{visible.map((review) => <article key={review.id} className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0"><p className="font-semibold">{review.product_title}</p><p className="mt-1 text-sm text-muted-foreground">{review.is_sample ? "Clearly labeled sample review" : `By ${review.display_name}`} · {new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1"><div className="flex text-amber-500" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4" fill={i < review.rating ? "currentColor" : "none"} />)}</div>
            {review.is_sample && <Badge variant="outline">Sample</Badge>}
            <Badge variant={review.status === "approved" ? "default" : review.status === "rejected" ? "destructive" : "secondary"}>{review.status}</Badge></div>
        </div>
        {review.title && <h2 className="mt-3 break-words font-medium [overflow-wrap:anywhere]">{review.title}</h2>}
        <p className={`mt-2 min-w-0 max-w-full break-words [overflow-wrap:anywhere] whitespace-pre-wrap text-sm leading-6 text-muted-foreground ${expanded === review.id ? "" : "line-clamp-3"}`}>{review.comment}</p>
        {review.comment.length > 180 && <Button size="sm" variant="ghost" className="mt-1 px-0" onClick={() => setExpanded(expanded === review.id ? null : review.id)}>{expanded === review.id ? "Show less" : "Read more"}</Button>}
        <div className="mt-4 flex flex-wrap gap-2">{!review.is_sample && review.status === "pending" && <><Button size="sm" disabled={busyId === review.id} onClick={() => { setTarget(review); setAction("approve"); }}><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" disabled={busyId === review.id} onClick={() => { setTarget(review); setAction("reject"); }}><X className="mr-1 h-4 w-4" />Reject</Button></>}
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === review.id} onClick={() => { setTarget(review); setAction("delete"); }}><Trash2 className="mr-1 h-4 w-4" />Delete</Button></div>
      </article>)}</div>}
    <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{action === "approve" ? "Approve this review?" : action === "reject" ? "Reject this review?" : "Delete this review?"}</AlertDialogTitle>
        <AlertDialogDescription>{action === "approve" ? "This review will be visible on the public product page." : action === "reject" ? "This review will remain private to its author." : "This permanently removes the review and cannot be undone."}</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void mutateReview()}>{action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Delete review"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </div>;
}
