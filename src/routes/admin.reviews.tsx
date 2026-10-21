import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { friendlyError } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/auth";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({ meta: [{ title: "Reviews — Edu Wallet Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminReviews,
});

type Status = "pending" | "approved" | "rejected";
type AdminReview = {
  id: string; product_id: string; user_id: string; rating: number; title: string; comment: string;
  status: Status; created_at: string; product_title: string; display_name: string;
};

const reviewsQuery = () => ({
  queryKey: ["admin", "reviews"] as const,
  queryFn: async (): Promise<AdminReview[]> => {
    const { data, error } = await supabase.from("reviews")
      .select("id,product_id,user_id,rating,title,comment,status,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const productIds = [...new Set(rows.map((row) => row.product_id))];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const [{ data: products, error: productsError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from("products").select("id,title").in("id", productIds),
      supabase.from("profiles").select("id,full_name").in("id", userIds),
    ]);
    if (productsError) throw productsError;
    if (productsError) throw productsError;
    const productTitles = new Map((products ?? []).map((product) => [product.id, product.title]));
    const displayNames = new Map((profilesError ? [] : profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    return rows.map((row) => ({
      ...row,
      product_title: productTitles.get(row.product_id) || "Deleted product",
      display_name: displayNames.get(row.user_id) || "Student",
    })) as AdminReview[];
  },
});

function AdminReviews() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);
  const reviews = useQuery({ ...reviewsQuery(), enabled: !!user && !!isAdmin });
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "delete">("approve");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(() => {
    const rows = reviews.data ?? [];
    return { pending: rows.filter((r) => r.status === "pending").length, approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length, all: rows.length };
  }, [reviews.data]);
  const visible = (reviews.data ?? []).filter((r) => filter === "all" || r.status === filter);

  const mutateReview = async () => {
    if (!target) return;
    setBusyId(target.id);
    try {
      if (action === "delete") {
        const { error } = await supabase.from("reviews").delete().eq("id", target.id);
        if (error) throw error;
      } else {
        const status: Status = action === "approve" ? "approved" : "rejected";
        const { error } = await supabase.from("reviews").update({ status, updated_at: new Date().toISOString() }).eq("id", target.id);
        if (error) throw error;
      }
      setTarget(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "reviews"] }),
        qc.invalidateQueries({ queryKey: ["reviews", target.product_id] }),
        qc.invalidateQueries({ queryKey: ["review-summary", target.product_id] }),
        qc.invalidateQueries({ queryKey: ["my-review", target.product_id, target.user_id] }),
      ]);
      toast.success(action === "delete" ? "Review deleted." : action === "approve" ? "Review approved." : "Review rejected.");
    } catch (error) {
      toast.error(friendlyError(error, "Could not update this review."));
    } finally {
      setBusyId(null);
    }
  };

  if (roleLoading) return <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-32 w-full" /></div>;
  if (!user || !isAdmin) return <div className="rounded-xl border border-border p-6"><h1 className="text-xl font-semibold">Access denied</h1><p className="mt-2 text-sm text-muted-foreground">This area is restricted to administrators.</p></div>;

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Ratings & Reviews</h1><p className="mt-1 text-sm text-muted-foreground">Moderate reviews from verified customers.</p></div>
    <div className="flex flex-wrap gap-2">
      {(["pending", "approved", "rejected", "all"] as const).map((status) => <Button key={status} size="sm" variant={filter === status ? "default" : "outline"} onClick={() => setFilter(status)} className="capitalize">{status} <span className="ml-1 tabular-nums">{counts[status]}</span></Button>)}
    </div>
    {reviews.isLoading ? <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div> :
      reviews.isError ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm">Could not load reviews. {friendlyError(reviews.error)} <Button size="sm" variant="outline" className="ml-2" onClick={() => void reviews.refetch()}>Retry</Button></div> :
      visible.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No {filter === "all" ? "" : filter} reviews.</div> :
      <div className="space-y-3">{visible.map((review) => <article key={review.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="font-semibold">{review.product_title}</p>
            <p className="mt-1 text-sm text-muted-foreground">By {review.display_name} · {new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex text-amber-500" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4" fill={i < review.rating ? "currentColor" : "none"} />)}</div>
            <Badge variant={review.status === "approved" ? "default" : review.status === "rejected" ? "destructive" : "secondary"}>{review.status}</Badge>
          </div>
        </div>
        {review.title && <h2 className="mt-3 font-medium">{review.title}</h2>}
        <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground ${expanded === review.id ? "" : "line-clamp-3"}`}>{review.comment}</p>
        {review.comment.length > 180 && <Button size="sm" variant="ghost" className="mt-1 px-0" onClick={() => setExpanded(expanded === review.id ? null : review.id)}>{expanded === review.id ? "Show less" : "Read more"}</Button>}
        <div className="mt-4 flex flex-wrap gap-2">
          {review.status === "pending" && <>
            <Button size="sm" disabled={busyId === review.id} onClick={() => { setTarget(review); setAction("approve"); }}><Check className="mr-1 h-4 w-4" />Approve</Button>
            <Button size="sm" variant="outline" disabled={busyId === review.id} onClick={() => { setTarget(review); setAction("reject"); }}><X className="mr-1 h-4 w-4" />Reject</Button>
          </>}
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === review.id} onClick={() => { setTarget(review); setAction("delete"); }}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
        </div>
      </article>)}</div>}
    <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
      <AlertDialogContent><AlertDialogHeader>
        <AlertDialogTitle>{action === "approve" ? "Approve this review?" : action === "reject" ? "Reject this review?" : "Delete this review?"}</AlertDialogTitle>
        <AlertDialogDescription>{action === "approve" ? "This review will be visible on the public product page." : action === "reject" ? "This review will remain private to its author." : "This permanently removes the review and cannot be undone."}</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void mutateReview()}>{action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Delete review"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
