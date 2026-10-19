-- Repair historical order types after product_type was introduced with a default.
-- The linked product's explicit product_type is authoritative for backfilling old orders.
UPDATE public.orders o
SET product_type = p.product_type
FROM public.products p
WHERE o.product_id = p.id
  AND p.product_type IN ('pdf', 'physical')
  AND o.product_type IS DISTINCT FROM p.product_type;

ALTER TABLE public.orders
  ALTER COLUMN product_type SET DEFAULT 'pdf',
  ALTER COLUMN product_type SET NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_product_type_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_type_check
  CHECK (product_type IN ('pdf', 'physical'));
