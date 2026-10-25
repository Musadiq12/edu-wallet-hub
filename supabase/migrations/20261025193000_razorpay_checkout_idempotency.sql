BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key text,
  ADD COLUMN IF NOT EXISTS razorpay_creation_started_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_razorpay_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_razorpay_status_check
  CHECK (razorpay_status IN ('creating', 'created', 'paid', 'fulfilled', 'failed', 'partially_refunded', 'refunded'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_user_checkout_idempotency_unique
  ON public.orders (user_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.orders.checkout_idempotency_key IS
  'Client-generated request identifier used to prevent duplicate Razorpay order records for retry/replayed checkout requests.';

COMMIT;