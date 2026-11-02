ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_images text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.products.product_images IS
  'Additional public product image paths in product-covers/R2; cover_image remains the primary image.';
