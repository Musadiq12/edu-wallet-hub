import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverImage } from "@/components/CoverImage";
import { discountPercent, effectivePrice, formatPrice, hasDiscount } from "@/lib/format";
import type { Product } from "@/lib/catalog";
import { getStockMessage } from "@/lib/stock";

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const price = Number(product.price ?? 0);
  const discounted =
    product.discounted_price != null ? Number(product.discounted_price) : null;
  const off = discountPercent(price, discounted);
  const discountedPrice = hasDiscount(price, discounted);
  const stockMessage = getStockMessage(product);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <Link
        to="/shop/$slug"
        params={{ slug: product.slug }}
        className="block overflow-hidden rounded-t-xl"
        aria-label={`View details for ${product.title}`}
      >
        <CoverImage path={product.cover_image} title={product.title} className="aspect-[4/3]" />
      </Link>

      <div className={compact ? "flex flex-1 flex-col px-3.5 pb-3.5 pt-2" : "flex flex-1 flex-col px-4 pb-4 pt-2"}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{product.product_type === "physical" ? "Physical copy" : "Digital PDF"}</Badge>
          {product.is_demo && (
            <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
              Demo
            </Badge>
          )}
          {product.is_free ? (
            <Badge className="bg-success text-success-foreground">Free</Badge>
          ) : (
            discountedPrice && <Badge className="bg-accent text-accent-foreground">{off}% OFF</Badge>
          )}
        </div>

        <h3 className={compact ? "mt-2 line-clamp-2 text-sm leading-snug font-semibold" : "mt-2 line-clamp-2 text-base leading-snug font-semibold"}>
          <Link to="/shop/$slug" params={{ slug: product.slug }} className="hover:underline">
            {product.title}
          </Link>
        </h3>

        <p className="mt-1 text-xs text-muted-foreground">
          {[product.course_label, product.subject_label].filter(Boolean).join(" · ") || (product.product_type === "physical" ? "Physical book / printed notes" : "Digital study resource")}
        </p>

        {product.description && !compact && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {product.format}
          {product.page_count ? ` · ${product.page_count} pages` : ""}
        </p>

        {stockMessage && (
          <p
            className={`mt-3 inline-flex w-fit items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${stockMessage.tone === "out" ? "border-destructive/30 bg-destructive/5 text-destructive" : stockMessage.tone === "low" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-success/25 bg-success/5 text-success"}`}
            aria-label={stockMessage.label}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${stockMessage.tone === "out" ? "bg-destructive" : stockMessage.tone === "low" ? "bg-amber-500" : "bg-success"}`} aria-hidden="true" />
            {stockMessage.label}
          </p>
        )}

        <div className="mt-4 flex items-baseline gap-2">
          {product.is_free ? (
            <span className="text-lg font-semibold text-success">Free</span>
          ) : (
            <>
              <span className="text-lg font-semibold">
                {formatPrice(effectivePrice(product))}
              </span>
              {discountedPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(price)}
                </span>
              )}
            </>
          )}
        </div>

        <div className="mt-auto flex gap-2 pt-4">
          {product.is_free && product.pdf_file && /^https:\/\/(drive\.google\.com|docs\.google\.com)\//i.test(product.pdf_file) ? (
            <Button variant={compact ? "default" : "outline"} size="sm" className="flex-1" asChild>
              <a href={product.pdf_file} target="_blank" rel="noopener noreferrer">
                Open Resource
              </a>
            </Button>
          ) : (
            <Button variant={compact ? "default" : "outline"} size="sm" className="flex-1" asChild>
              <Link to="/shop/$slug" params={{ slug: product.slug }}>
                View Details
              </Link>
            </Button>
          )}
          {!product.is_free && !compact && product.product_type !== "physical" && (
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
