import { BookOpen } from "lucide-react";
import { publicImageUrl, responsiveImageSrcSet } from "@/lib/image-storage";

export function CoverImage({
  path,
  title,
  className = "aspect-[4/3]",
  priority = false,
}: {
  path: string | null;
  title: string;
  className?: string;
  priority?: boolean;
}) {
  const url = publicImageUrl("product-covers", path, 400);
  const srcSet = responsiveImageSrcSet("product-covers", path);

  return (
    <div className={`relative w-full overflow-hidden bg-muted ${className}`}>
      {url ? (
        <img
          src={url}
          srcSet={srcSet}
          sizes="(max-width: 639px) 72vw, (max-width: 1023px) 280px, 270px"
          alt={`Cover of ${title}`}
          width={400}
          height={300}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="absolute inset-0 block h-full w-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted" aria-hidden="true">
          <BookOpen className="h-8 w-8 text-muted-foreground/60" />
        </div>
      )}
    </div>
  );
}
