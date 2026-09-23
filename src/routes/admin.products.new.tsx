import { createFileRoute, Link } from "@tanstack/react-router";
import { ProductForm } from "@/components/admin/ProductForm";

export const Route = createFileRoute("/admin/products/new")({ component: NewProduct });

function NewProduct() {
  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/products" className="text-sm text-primary hover:underline">← Back to products</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save as draft to keep it hidden, or publish to make it visible on the Shop immediately.
        </p>
      </div>
      <ProductForm />
    </div>
  );
}
