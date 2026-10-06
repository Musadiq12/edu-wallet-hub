import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/catalog";

export function ProductCarousel({ title, description, products }: { title: string; description?: string; products: Product[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const scroll = (direction: "left" | "right") => {
    const element = scroller.current;
    element?.scrollBy({ left: direction === "right" ? element.clientWidth * 0.8 : -element.clientWidth * 0.8, behavior: "smooth" });
  };
  const headingId = `carousel-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section className="py-10" aria-labelledby={headingId}>
      <div className="page-container">
        <div className="flex items-end justify-between gap-4">
          <div><h2 id={headingId} className="text-2xl font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}</div>
          <div className="flex gap-1">
            <button type="button" aria-label={`Scroll ${title} left`} onClick={() => scroll("left")} className="flex size-11 items-center justify-center rounded-md border border-border bg-card hover:bg-accent"><ChevronLeft className="size-4" aria-hidden="true" /></button>
            <button type="button" aria-label={`Scroll ${title} right`} onClick={() => scroll("right")} className="flex size-11 items-center justify-center rounded-md border border-border bg-card hover:bg-accent"><ChevronRight className="size-4" aria-hidden="true" /></button>
          </div>
        </div>
        <div ref={scroller} className="mt-5 flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{products.map((product) => <div key={product.id} className="w-[78vw] shrink-0 sm:w-[280px]"><ProductCard product={product} compact /></div>)}</div>
      </div>
    </section>
  );
}
