import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "@/lib/catalog";

export type CartItem = {
  productId: string; slug: string; title: string; productType: "pdf" | "physical";
  price: number; quantity: number; coverImage: string | null; stockQuantity: number;
};
type CartContextValue = {
  items: CartItem[]; ready: boolean; count: number; subtotal: number;
  add: (product: Product) => void; setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void; clear: () => void;
};
const STORAGE_KEY = "eduwallet:cart:v1";
const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CartItem =>
      !!item && typeof item.productId === "string" && typeof item.slug === "string" &&
      typeof item.title === "string" && (item.productType === "pdf" || item.productType === "physical") &&
      Number.isFinite(item.price) && item.price >= 0 && Number.isInteger(item.quantity) &&
      item.quantity >= 1 && item.quantity <= 100
    );
  } catch { return []; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { setItems(readCart()); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* Storage may be unavailable. */ }
  }, [items, ready]);
  const add = useCallback((product: Product) => {
    const price = Number(product.discounted_price != null && Number(product.discounted_price) > 0
      ? product.discounted_price : product.price);
    if (!Number.isFinite(price) || price <= 0 || !product.is_active || product.is_free) return;
    setItems(current => {
      const existing = current.find(item => item.productId === product.id);
      if (existing) return current.map(item => item.productId === product.id
        ? { ...item, quantity: Math.min(item.quantity + 1, item.productType === "physical" ? Math.max(1, product.stock_quantity) : 100) }
        : item);
      return [...current, {
        productId: product.id, slug: product.slug, title: product.title,
        productType: product.product_type, price, quantity: 1,
        coverImage: product.cover_image, stockQuantity: product.stock_quantity,
      }];
    });
  }, []);
  const setQuantity = useCallback((id: string, quantity: number) => setItems(current =>
    current.map(item => item.productId !== id ? item : {
      ...item, quantity: Math.max(1, Math.min(100, Math.floor(quantity) || 1,
        item.productType === "physical" ? Math.max(1, item.stockQuantity) : 100)),
    })), []);
  const remove = useCallback((id: string) => setItems(current => current.filter(item => item.productId !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({
    items, ready, count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    add, setQuantity, remove, clear,
  }), [items, ready, add, setQuantity, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}
