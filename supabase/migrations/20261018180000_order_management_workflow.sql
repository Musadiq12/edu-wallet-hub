ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Pending', 'Payment Verified', 'Dispatched', 'Cancelled'));

UPDATE public.orders
SET status = CASE
  WHEN order_status = 'cancelled' THEN 'Cancelled'
  WHEN order_status = 'delivered' THEN 'Dispatched'
  WHEN payment_status = 'verified' OR order_status IN ('payment_verified', 'processing') THEN 'Payment Verified'
  ELSE 'Pending'
END;

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('Pending', 'Payment Verified', 'Dispatched', 'Cancelled')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS order_status_history_order_time_idx
  ON public.order_status_history(order_id, changed_at DESC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read order status history" ON public.order_status_history;
CREATE POLICY "admin read order status history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.record_order_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history(order_id, status, changed_at, changed_by)
    VALUES (NEW.id, NEW.status, COALESCE(NEW.created_at, now()), auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history(order_id, status, changed_at, changed_by)
    VALUES (NEW.id, NEW.status, now(), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_history_trigger ON public.orders;
CREATE TRIGGER orders_status_history_trigger
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_order_status_history();

INSERT INTO public.order_status_history(order_id, status, changed_at)
SELECT o.id, o.status, o.created_at
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_status_history h WHERE h.order_id = o.id
);