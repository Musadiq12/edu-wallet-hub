import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { signedUrl } from "@/lib/catalog";

export function CoverImage({
  path,
  title,
  className = "aspect-[4/3]",
}: {
  path: string | null;
  title: string;
  className?: string;
}) {
  const { data: url } = useQuery({
    queryKey: ["cover", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: () => signedUrl("product-covers", path),
  });

  if (path && url) {
    return (
      <img
        src={url}
        alt={`Cover of ${title}`}
        loading="lazy"
        decoding="async"
        className={`w-full object-cover transition-transform duration-300 ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex w-full items-center justify-center border-b border-border bg-surface ${className}`}
      aria-hidden="true"
    >
      <BookOpen className="h-8 w-8 text-muted-foreground/60" />
    </div>
  );
}
