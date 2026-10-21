import { queryOptions } from "@tanstack/react-query";
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

export type ReviewSummary = {
  average: number;
  count: number;
  distribution: number[];
};

const REVIEW_FIELDS = "id,product_id,user_id,rating,title,comment,status,created_at,updated_at";
const reviewKey = (productId: string) => ["reviews", productId] as const;
const summaryKey = (productId: string) => ["review-summary", productId] as const;
const myReviewKey = (productId: string, userId: string | undefined) =>
  ["my-review", productId, userId] as const;
const canReviewKey = (productId: string, userId: string | undefined) =>
  ["can-review", productId, userId] as const;

export const productReviewsQuery = (productId: string) =>
  queryOptions({
    queryKey: reviewKey(productId),
    enabled: !!productId,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`${REVIEW_FIELDS},profiles(full_name)`)
        .eq("product_id", productId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          ...row,
          display_name: profile?.full_name || "Student",
        } as unknown as Review;
      });
    },
  });

export const reviewSummaryQuery = (productId: string) =>
  queryOptions({
    queryKey: summaryKey(productId),
    enabled: !!productId,
    queryFn: async (): Promise<ReviewSummary> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("rating")
        .eq("product_id", productId)
        .eq("status", "approved");
      if (error) throw error;
      const ratings = (data ?? []).map((item) => item.rating);
      const distribution = [5, 4, 3, 2, 1].map(
        (star) => ratings.filter((rating) => rating === star).length,
      );
      return {
        average: ratings.length
          ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
          : 0,
        count: ratings.length,
        distribution,
      };
    },
  });

export const myReviewQuery = (productId: string, userId: string | undefined) =>
  queryOptions({
    queryKey: myReviewKey(productId, userId),
    enabled: !!productId && !!userId,
    queryFn: async (): Promise<Review | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("reviews")
        .select(REVIEW_FIELDS)
        .eq("product_id", productId)
        .eq("user_id", userId)
        .maybeSingle();
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
      const { data, error } = await supabase.rpc("has_verified_purchase", {
        p_product_id: productId,
        p_user_id: userId,
      });
      if (error) throw error;
      return data === true;
    },
  });

async function invalidateReviewQueries(productId: string, userId?: string) {
  // Mutations remain independent of a global QueryClient singleton.
  void productId;
  void userId;
}

export async function submitReview(input: {
  productId: string;
  userId: string;
  rating: number;
  title: string;
  comment: string;
}) {
  const title = input.title.trim();
  const comment = input.comment.trim();
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Choose a rating from 1 to 5 stars.");
  }
  if (!comment || comment.length > 1000 || title.length > 100) {
    throw new Error("Enter a comment of 1–1000 characters and a title under 100 characters.");
  }
  const { error } = await supabase.from("reviews").insert({
    product_id: input.productId,
    user_id: input.userId,
    rating: input.rating,
    title,
    comment,
    status: "pending",
  });
  if (error) throw new Error(friendlyError(error, "Could not submit your review."));
  await invalidateReviewQueries(input.productId, input.userId);
}

export async function updateMyReview(
  reviewId: string,
  input: { productId: string; userId: string; rating: number; title: string; comment: string },
) {
  const title = input.title.trim();
  const comment = input.comment.trim();
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Choose a rating from 1 to 5 stars.");
  }
  if (!comment || comment.length > 1000 || title.length > 100) {
    throw new Error("Enter a comment of 1–1000 characters and a title under 100 characters.");
  }
  const { data, error } = await supabase
    .from("reviews")
    .update({ rating: input.rating, title, comment, updated_at: new Date().toISOString() })
    .eq("id", reviewId)
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(friendlyError(error, "Could not update your review."));
  if (!data) throw new Error("Only a pending review can be edited.");
  await invalidateReviewQueries(input.productId, input.userId);
}
