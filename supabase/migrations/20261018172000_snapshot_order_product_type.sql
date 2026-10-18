ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'pdf';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_product_type_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_type_check
  CHECK (product_type IN ('pdf', 'physical'));