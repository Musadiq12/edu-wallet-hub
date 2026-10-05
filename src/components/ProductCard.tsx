import { Link } from "@tanstack/react-router";
import { BookOpenCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/CoverImage";
import { discountPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/catalog";

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const price = Number(product.price ?? 0);
  const discounted =
    product.discounted_price != null ? Number(product.discounted_price) : null;
  const off = discountPercent(price, discounted);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <Link
        to="/shop/$slug"
        params={{ slug: product.slug }}
        className="block overflow-hidden"
        aria-label={`View details for ${product.title}`}
      >
        <div className="grid aspect-[4/3] place-items-center bg-slate-950 p-6 text-white"><div className="w-full max-w-[240px] border border-white/15 bg-white/5 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">{product.course_label}</p><BookOpenCheck className="mt-8 size-7 text-amber-300" /><p className="mt-3 text-xl font-bold leading-tight">{product.title}</p><p className="mt-2 text-xs text-slate-400">{product.test_type}</p></div></div>
      </Link>

      <div className={compact ? "flex flex-1 flex-col p-3.5" : "flex flex-1 flex-col p-4"}>
        <div className="flex flex-wrap items-center gap-1.5">
          {product.is_demo && (
            <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
              Demo
            </Badge>
          )}
          {product.is_free ? (
            <Badge className="bg-success text-success-foreground">Free</Badge>
          ) : (
            off && <Badge className="bg-accent text-accent-foreground">{off}% OFF</Badge>
          )}
        </div>

        <h3 className={compact ? "mt-2 line-clamp-2 text-sm leading-snug font-semibold" : "mt-2 line-clamp-2 text-base leading-snug font-semibold"}>
          <Link to="/shop/$slug" params={{ slug: product.slug }} className="hover:underline">
            {product.title}
          </Link>
        </h3>

        <p className="mt-1 text-xs text-muted-foreground">
          {[product.course_label, product.subject_label].filter(Boolean).join(" · ") || "Digital study resource"}
        </p>

        {product.description && !compact && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">{product.validity_days ? `${product.validity_days} days access` : "Flexible access"} · {product.format}</p>

        <div className="mt-4 flex items-baseline gap-2">
          {product.is_free ? (
            <span className="text-lg font-semibold text-success">Free</span>
          ) : (
            <>
              <span className="text-lg font-semibold">
                {formatPrice(discounted ?? price)}
              </span>
              {off && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(price)}
                </span>
              )}
            </>
          )}
        </div>

        <div className="mt-auto flex gap-2 pt-4">
          <Button variant={compact ? "default" : "outline"} size="sm" className="flex-1" asChild>
            <Link to="/shop/$slug" params={{ slug: product.slug }}>
              View Details
            </Link>
          </Button>
          {!product.is_free && !compact && (
            <Button size="sm" className="flex-1" asChild>
              <Link to="/checkout/$slug" params={{ slug: product.slug }}>Buy Now <ArrowRight className="ml-1 inline size-3.5" /></Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
