import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/CoverImage";
import { discountPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/catalog";

export function ProductCard({ product }: { product: Product }) {
  const price = Number(product.price ?? 0);
  const discounted =
    product.discounted_price != null ? Number(product.discounted_price) : null;
  const off = discountPercent(price, discounted);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40">
      <Link
        to="/shop/$slug"
        params={{ slug: product.slug }}
        className="block"
        aria-label={`View details for ${product.title}`}
      >
        <CoverImage path={product.cover_image} title={product.title} />
      </Link>

      <div className="flex flex-1 flex-col p-4">
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

        <h3 className="mt-2 line-clamp-2 font-serif text-base leading-snug font-semibold">
          <Link to="/shop/$slug" params={{ slug: product.slug }} className="hover:underline">
            {product.title}
          </Link>
        </h3>

        <p className="mt-1 text-xs text-muted-foreground">
          {[product.course_label, product.subject_label].filter(Boolean).join(" · ") || "IGNOU"}
        </p>

        {product.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {product.format}
          {product.page_count ? ` · ${product.page_count} pages` : ""}
        </p>

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

        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to="/shop/$slug" params={{ slug: product.slug }}>
              View Details
            </Link>
          </Button>
          {!product.is_free && (
            <Button size="sm" className="flex-1" asChild>
              <Link to="/checkout/$slug" params={{ slug: product.slug }}>
                Buy Now
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
