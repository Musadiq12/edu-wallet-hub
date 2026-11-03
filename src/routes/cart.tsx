import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: buildTitle(["Shopping Cart", BRAND]) }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  if (!cart.ready) return <div className="page-container section-y"><p className="text-sm text-muted-foreground">Loading your cart…</p></div>;
  return <div className="page-container section-y">
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">EduWallet</p><h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Your cart</h1><p className="mt-2 text-sm text-muted-foreground">{cart.count} {cart.count === 1 ? "item" : "items"}</p></div>
        {cart.items.length > 0 && <Button variant="ghost" onClick={cart.clear}>Clear cart</Button>}
      </div>
      {cart.items.length === 0 ? <div className="mt-8 rounded-2xl border border-border bg-card px-6 py-14 text-center">
        <ShoppingBag className="mx-auto size-10 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">Your cart is empty</h2><p className="mt-2 text-sm text-muted-foreground">Browse study resources and add products to your cart.</p><Button asChild className="mt-6"><Link to="/shop">Browse shop</Link></Button>
      </div> : <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="divide-y divide-border rounded-2xl border border-border bg-card px-4 sm:px-6">
          {cart.items.map(item => <article key={item.productId} className="flex gap-4 py-5">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-xs text-muted-foreground">{item.coverImage ? <img src={item.coverImage} alt="" className="size-full object-cover" /> : <ShoppingBag className="size-6" />}</div>
            <div className="min-w-0 flex-1">
              <Link to="/shop/$slug" params={{slug:item.slug}} className="font-semibold leading-snug hover:text-primary">{item.title}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{item.productType === "physical" ? "Physical product" : "Digital PDF"}</p>
              <p className="mt-2 font-semibold">{formatPrice(item.price)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-lg border border-border">
                  <Button variant="ghost" size="icon" className="size-9" aria-label={"Decrease quantity for " + item.title} onClick={() => cart.setQuantity(item.productId,item.quantity-1)}><Minus className="size-3.5"/></Button>
                  <span className="min-w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="size-9" aria-label={"Increase quantity for " + item.title} disabled={item.productType === "physical" && item.quantity >= item.stockQuantity} onClick={() => cart.setQuantity(item.productId,item.quantity+1)}><Plus className="size-3.5"/></Button>
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => cart.remove(item.productId)}><Trash2 className="mr-1.5 size-4"/>Remove</Button>
              </div>
              {item.productType === "physical" && item.quantity > item.stockQuantity && <p className="mt-2 text-xs text-destructive">Stock changed. Update quantity before checkout.</p>}
            </div>
            <p className="shrink-0 font-semibold tabular-nums">{formatPrice(item.price*item.quantity)}</p>
          </article>)}
        </div>
        <aside className="h-fit rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Order summary</h2><div className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">{formatPrice(cart.subtotal)}</span></div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Shipping, applicable discounts and final stock availability are confirmed at checkout.</p>
          <Button className="mt-5 w-full" disabled>Checkout is being connected</Button>
          <Button asChild variant="outline" className="mt-2 w-full"><Link to="/shop">Continue shopping</Link></Button>
        </aside>
      </div>}
    </div>
  </div>;
}
