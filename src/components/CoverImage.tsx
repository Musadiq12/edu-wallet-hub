import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function CoverImage({
  path,
  title,
  className = "aspect-[4/3]",
}: {
  path: string | null;
  title: string;
  className?: string;
}) {
  const url = path ? supabase.storage.from("product-covers").getPublicUrl(path).data.publicUrl : null;

  if (path && url) {
    return (
      <img
        src={url}
        alt={`Cover of ${title}`}
        loading="lazy"
        decoding="async"
        className={`block h-full w-full object-contain bg-surface ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex min-h-64 w-full items-center justify-center border-b border-border bg-surface ${className}`}
      aria-hidden="true"
    >
      <BookOpen className="h-8 w-8 text-muted-foreground/60" />
    </div>
  );
}
