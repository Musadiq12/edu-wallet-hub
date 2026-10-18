-- Physical-book checkout and courier tracking fields.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state TEXT,
  ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS delivery_country TEXT NOT NULL DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS courier_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS courier_tracking_url TEXT;

COMMENT ON COLUMN public.orders.delivery_address IS 'Customer-supplied shipping street/locality address.';
COMMENT ON COLUMN public.orders.courier_tracking_id IS 'Courier shipment or tracking ID entered by an administrator.';
