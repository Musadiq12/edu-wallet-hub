export function formatPrice(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function discountPercent(
  price: number | null | undefined,
  discounted: number | null | undefined,
): number | null {
  const p = Number(price ?? 0);
  const d = Number(discounted ?? 0);
  if (!p || !discounted || d >= p) return null;
  return Math.round(((p - d) / p) * 100);
}

export function effectivePrice(product: {
  price: number | string | null;
  discounted_price: number | string | null;
  is_free: boolean;
}): number {
  if (product.is_free) return 0;
  const d = product.discounted_price != null ? Number(product.discounted_price) : null;
  return d != null && d > 0 ? d : Number(product.price ?? 0);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending Payment",
  payment_submitted: "Payment Submitted",
  payment_verified: "Payment Verified",
  payment_rejected: "Payment Rejected",
  processing: "Processing",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  verified: "Verified",
  rejected: "Rejected",
};
