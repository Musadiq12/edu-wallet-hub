-- Freeze each order's delivery type at checkout, not at admin-action time.
-- Historical orders may predate products.product_type; backfill those from their linked product.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_type text;

UPDATE public.orders o
SET product_type = COALESCE(p.product_type, 'pdf')
FROM public.products p
WHERE o.product_id = p.id
  AND o.product_type IS NULL;

UPDATE public.orders
SET product_type = 'pdf'
WHERE product_type IS NULL OR product_type NOT IN ('pdf', 'physical');

ALTER TABLE public.orders
  ALTER COLUMN product_type SET DEFAULT 'pdf',
  ALTER COLUMN product_type SET NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_product_type_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_type_check
  CHECK (product_type IN ('pdf', 'physical'));

