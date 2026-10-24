import { BookOpen } from "lucide-react";
import { publicImageUrl } from "@/lib/image-storage";

export function CoverImage({
  path,
  title,
  className = "aspect-[4/3]",
}: {
  path: string | null;
  title: string;
  className?: string;
}) {
  const url = publicImageUrl("product-covers", path);

  return (
    <div
      className={`relative w-full overflow-hidden bg-muted ${className}`}
    >
      {url ? (
        <img
          src={url}
          alt={`Cover of ${title}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 block h-full w-full object-cover object-center"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted"
          aria-hidden="true"
        >
          <BookOpen className="h-8 w-8 text-muted-foreground/60" />
        </div>
      )}
    </div>
  );
}
