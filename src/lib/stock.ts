import type { Product } from "@/lib/catalog";

/** Returns the public stock message for physical products only. */
export function getStockMessage(product: Pick<Product, "product_type" | "stock_quantity" | "stock_status" | "low_stock_threshold">) {
  if (product.product_type !== "physical") return null;
  const quantity = Number(product.stock_quantity ?? 0);
  if (product.stock_status === "out_of_stock" || quantity <= 0) {
    return { label: "Out of stock", tone: "out" as const };
  }
  const threshold = product.low_stock_threshold == null ? 5 : Number(product.low_stock_threshold);
  if (threshold > 0 && quantity <= threshold) {
    return { label: quantity === 1 ? "Only 1 left" : `Only ${quantity} left`, tone: "low" as const };
  }
  return { label: "In stock", tone: "in" as const };
}
