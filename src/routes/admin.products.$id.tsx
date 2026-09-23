import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductForm } from "@/components/admin/ProductForm";
import { adminProductQuery } from "@/lib/admin";

export const Route = createFileRoute("/admin/products/$id")({ component: EditProduct });

function EditProduct() {
  const { id } = Route.useParams();
  const { data, isLoading, isError } = useQuery(adminProductQuery(id));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/products" className="text-sm text-primary hover:underline">← Back to products</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit product</h1>
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">We could not load this product. Please try again.</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">This product no longer exists.</p>
      ) : (
        <ProductForm product={data} />
      )}
    </div>
  );
}
