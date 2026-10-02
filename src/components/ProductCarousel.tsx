import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/catalog";

export function ProductCarousel({
  title,
  description,
  products,
}: {
  title: string;
  description?: string;
  products: Product[];
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const element = scroller.current;
    if (!element) return;
    element.scrollBy({ left: direction === "right" ? element.clientWidth * 0.82 : -element.clientWidth * 0.82, behavior: "smooth" });
  };

  if (!products.length) return null;

  return (
    <section className="section-y" aria-label={title}>
      <div className="page-container">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
            {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <div className="hidden gap-2 sm:flex">
            <Button variant="outline" size="icon" aria-label={`Scroll ${title} left`} onClick={() => scroll("left")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label={`Scroll ${title} right`} onClick={() => scroll("right")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={scroller}
          className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <div key={product.id} className="w-[72vw] shrink-0 snap-start sm:w-[280px] md:w-[250px] lg:w-[270px]">
              <ProductCard product={product} compact />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
