export function formatPrice(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function hasDiscount(
  price: number | null | undefined,
  discounted: number | null | undefined,
): boolean {
  const p = Number(price ?? 0);
  const d = Number(discounted);
  return discounted != null && Number.isFinite(p) && Number.isFinite(d) && p > 0 && d >= 0 && d < p;
}

export function discountPercent(
  price: number | null | undefined,
  discounted: number | null | undefined,
): number | null {
  if (!hasDiscount(price, discounted)) return null;
  const percent = ((Number(price) - Number(discounted)) / Number(price)) * 100;
  return Math.round(percent) || Number(percent.toPrecision(2));
}

export function validateProductPricing(price: number, discounted: number | null, isFree: boolean): string | null {
  if (isFree) return null;
  if (!Number.isFinite(price) || price <= 0) return "Enter a valid price greater than 0.";
  if (discounted != null) {
    if (!Number.isFinite(discounted) || discounted < 0) return "Enter a valid discounted price.";
    if (discounted > price) return "The discounted price cannot exceed the original price.";
  }
  return null;
}

export function effectivePrice(product: {
  price: number | string | null;
  discounted_price: number | string | null;
  is_free: boolean;
}): number {
  if (product.is_free) return 0;
  const d = product.discounted_price != null ? Number(product.discounted_price) : null;
  return d != null && Number.isFinite(d) && d >= 0 && d <= Number(product.price) ? d : Number(product.price ?? 0);
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
