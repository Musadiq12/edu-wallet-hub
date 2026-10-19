-- Repair legacy physical orders that inherited the old default 'pdf'.
-- Only promote pdf -> physical when the linked product explicitly says physical;
-- preserve an already-recorded physical snapshot if a product type changed later.
UPDATE public.orders o
SET product_type = 'physical'
FROM public.products p
WHERE o.product_id = p.id
  AND o.product_type = 'pdf'
  AND p.product_type = 'physical';

ALTER TABLE public.orders
  ALTER COLUMN product_type SET DEFAULT 'pdf',
  ALTER COLUMN product_type SET NOT NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_product_type_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_type_check
  CHECK (product_type IN ('pdf', 'physical'));
