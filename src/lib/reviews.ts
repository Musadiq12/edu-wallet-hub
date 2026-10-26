import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/admin";

export type Review = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  comment: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  display_name?: string | null;
};

export type ReviewSummary = { average: number; count: number; distribution: number[] };

const FIELDS = "id,product_id,user_id,rating,title,comment,status,created_at,updated_at";
const reviewKey = (id: string) => ["reviews", id] as const;
const summaryKey = (id: string) => ["review-summary", id] as const;
const myReviewKey = (productId: string, userId?: string) => ["my-review", productId, userId] as const;
const canReviewKey = (productId: string, userId?: string) => ["can-review", productId, userId] as const;

export const productReviewsQuery = (productId: string) =>
  queryOptions({
    queryKey: reviewKey(productId),
    enabled: !!productId,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase.from("reviews")
        .select(FIELDS).eq("product_id", productId).eq("status", "approved")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const { data: profiles, error: profileError } = userIds.length
        ? await supabase.from("profiles").select("id,full_name").in("id", userIds)
        : { data: [], error: null };
      const names = new Map((profileError ? [] : profiles ?? []).map((profile) => [profile.id, profile.full_name]));
      return rows.map((row) => ({
        ...row,
        display_name: names.get(row.user_id) || "Student",
      })) as Review[];
    },
  });

export const reviewSummaryQuery = (productId: string) =>
  queryOptions({
    queryKey: summaryKey(productId),
    enabled: !!productId,
    queryFn: async (): Promise<ReviewSummary> => {
      const { data, error } = await supabase.from("reviews").select("rating")
        .eq("product_id", productId).eq("status", "approved");
      if (error) throw error;
      const ratings = (data ?? []).map(({ rating }) => rating);
      return {
        average: ratings.length ? Math.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length * 10) / 10 : 0,
        count: ratings.length,
        distribution: [5, 4, 3, 2, 1].map((star) => ratings.filter((rating) => rating === star).length),
      };
    },
  });

export const myReviewQuery = (productId: string, userId: string | undefined) =>
  queryOptions({
    queryKey: myReviewKey(productId, userId),
    enabled: !!productId && !!userId,
    queryFn: async (): Promise<Review | null> => {
      if (!userId) return null;
      const { data, error } = await supabase.from("reviews").select(FIELDS)
        .eq("product_id", productId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data as Review | null;
    },
  });

export const canReviewQuery = (productId: string, userId: string | undefined) =>
  queryOptions({
    queryKey: canReviewKey(productId, userId),
    enabled: !!productId && !!userId,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase.rpc("has_verified_purchase", { p_product_id: productId });
      if (error) throw error;
      return data === true;
    },
  });

async function invalidateReviewQueries(queryClient: QueryClient, productId: string, userId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: reviewKey(productId) }),
    queryClient.invalidateQueries({ queryKey: summaryKey(productId) }),
    queryClient.invalidateQueries({ queryKey: myReviewKey(productId, userId) }),
    queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }),
  ]);
}

export async function submitReview(input: {
  productId: string; userId: string; queryClient: QueryClient; rating: number; title: string; comment: string;
}) {
  const title = input.title.trim();
  const comment = input.comment.trim();
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("Choose a rating from 1 to 5 stars.");
  if (!comment || comment.length > 1000 || title.length > 100) throw new Error("Enter a comment of 1–1000 characters and a title under 100 characters.");
  const { error } = await supabase.from("reviews").insert({
    product_id: input.productId, user_id: input.userId, rating: input.rating, title, comment, status: "pending",
  });
  if (error) throw new Error(friendlyError(error, "Could not submit your review."));
  await invalidateReviewQueries(input.queryClient, input.productId, input.userId);
}

export async function updateMyReview(
  reviewId: string,
  input: { productId: string; userId: string; queryClient: QueryClient; rating: number; title: string; comment: string },
) {
  const title = input.title.trim();
  const comment = input.comment.trim();
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("Choose a rating from 1 to 5 stars.");
  if (!comment || comment.length > 1000 || title.length > 100) throw new Error("Enter a comment of 1–1000 characters and a title under 100 characters.");
  const { data, error } = await supabase.from("reviews").update({
    rating: input.rating, title, comment, updated_at: new Date().toISOString(),
  }).eq("id", reviewId).eq("user_id", input.userId).eq("status", "pending").select("id").maybeSingle();
  if (error) throw new Error(friendlyError(error, "Could not update your review."));
  if (!data) throw new Error("Only a pending review can be edited.");
  await invalidateReviewQueries(input.queryClient, input.productId, input.userId);
}
