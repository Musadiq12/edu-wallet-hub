BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_quantity_check,
  DROP CONSTRAINT IF EXISTS products_stock_status_check,
  DROP CONSTRAINT IF EXISTS products_low_stock_threshold_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_quantity_check CHECK (stock_quantity >= 0),
  ADD CONSTRAINT products_stock_status_check CHECK (stock_status IN ('in_stock', 'out_of_stock')),
  ADD CONSTRAINT products_low_stock_threshold_check CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0);

-- Existing physical products start at zero until the store owner confirms counts.
UPDATE public.products SET stock_quantity = 0, stock_status = 'out_of_stock'
WHERE product_type = 'physical' AND stock_quantity = 0;

-- Database-level protection: reservations and final payment settlement are idempotent per order.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS inventory_reserved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_deducted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_released boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_upsert_product(_product_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_id uuid;
  v_product_type text := COALESCE(NULLIF(_payload->>'product_type', ''), 'pdf');
  v_stock_quantity integer := 0;
  v_stock_status text := 'out_of_stock';
  v_low_stock_threshold integer := NULL;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_product_type NOT IN ('pdf', 'physical') THEN
    RAISE EXCEPTION 'Invalid product type';
  END IF;

  IF v_product_type = 'physical' THEN
    IF COALESCE(_payload->>'stock_quantity', '') !~ '^\d+$'
       OR (_payload->>'stock_quantity')::numeric > 2147483647 THEN
      RAISE EXCEPTION 'Stock quantity must be a non-negative whole number';
    END IF;
    v_stock_quantity := (_payload->>'stock_quantity')::integer;
    v_stock_status := COALESCE(NULLIF(_payload->>'stock_status', ''), CASE WHEN v_stock_quantity > 0 THEN 'in_stock' ELSE 'out_of_stock' END);
    IF v_stock_status NOT IN ('in_stock', 'out_of_stock') THEN
      RAISE EXCEPTION 'Invalid stock status';
    END IF;
    IF NULLIF(_payload->>'low_stock_threshold', '') IS NOT NULL THEN
      IF (_payload->>'low_stock_threshold') !~ '^\d+$'
         OR (_payload->>'low_stock_threshold')::numeric > 2147483647 THEN
        RAISE EXCEPTION 'Low-stock threshold must be a non-negative whole number';
      END IF;
      v_low_stock_threshold := (_payload->>'low_stock_threshold')::integer;
    END IF;
  END IF;

  IF _product_id IS NULL THEN
    INSERT INTO public.products (
      product_type, title, slug, description, whats_included, category_id,
      course_label, subject_label, keywords, price, discounted_price,
      page_count, format, is_free, is_featured, is_active,
      cover_image, pdf_file, preview_file, created_by,
      stock_quantity, stock_status, low_stock_threshold
    )
    VALUES (
      v_product_type,
      _payload->>'title',
      _payload->>'slug',
      NULLIF(_payload->>'description', ''),
      NULLIF(_payload->>'whats_included', ''),
      NULLIF(_payload->>'category_id', '')::uuid,
      NULLIF(_payload->>'course_label', ''),
      NULLIF(_payload->>'subject_label', ''),
      NULLIF(_payload->>'keywords', ''),
      COALESCE((_payload->>'price')::numeric, 0),
      CASE WHEN _payload->>'discounted_price' IS NULL OR _payload->>'discounted_price' = '' THEN NULL ELSE (_payload->>'discounted_price')::numeric END,
      CASE WHEN _payload->>'page_count' IS NULL OR _payload->>'page_count' = '' THEN NULL ELSE (_payload->>'page_count')::integer END,
      COALESCE(NULLIF(_payload->>'format', ''), CASE WHEN v_product_type = 'physical' THEN 'Physical copy' ELSE 'PDF' END),
      COALESCE((_payload->>'is_free')::boolean, false),
      COALESCE((_payload->>'is_featured')::boolean, false),
      COALESCE((_payload->>'is_active')::boolean, false),
      NULLIF(_payload->>'cover_image', ''),
      CASE WHEN v_product_type = 'pdf' THEN NULLIF(_payload->>'pdf_file', '') ELSE NULL END,
      CASE WHEN v_product_type = 'pdf' THEN NULLIF(_payload->>'preview_file', '') ELSE NULL END,
      auth.uid(),
      v_stock_quantity, v_stock_status, v_low_stock_threshold
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.products
    SET
      product_type = v_product_type,
      title = _payload->>'title',
      slug = _payload->>'slug',
      description = NULLIF(_payload->>'description', ''),
      whats_included = NULLIF(_payload->>'whats_included', ''),
      category_id = NULLIF(_payload->>'category_id', '')::uuid,
      course_label = NULLIF(_payload->>'course_label', ''),
      subject_label = NULLIF(_payload->>'subject_label', ''),
      keywords = NULLIF(_payload->>'keywords', ''),
      price = COALESCE((_payload->>'price')::numeric, 0),
      discounted_price = CASE WHEN _payload->>'discounted_price' IS NULL OR _payload->>'discounted_price' = '' THEN NULL ELSE (_payload->>'discounted_price')::numeric END,
      page_count = CASE WHEN _payload->>'page_count' IS NULL OR _payload->>'page_count' = '' THEN NULL ELSE (_payload->>'page_count')::integer END,
      format = COALESCE(NULLIF(_payload->>'format', ''), CASE WHEN v_product_type = 'physical' THEN 'Physical copy' ELSE 'PDF' END),
      is_free = COALESCE((_payload->>'is_free')::boolean, false),
      is_featured = COALESCE((_payload->>'is_featured')::boolean, false),
      is_active = COALESCE((_payload->>'is_active')::boolean, false),
      cover_image = NULLIF(_payload->>'cover_image', ''),
      pdf_file = CASE WHEN v_product_type = 'pdf' THEN NULLIF(_payload->>'pdf_file', '') ELSE NULL END,
      preview_file = CASE WHEN v_product_type = 'pdf' THEN NULLIF(_payload->>'preview_file', '') ELSE NULL END,
      stock_quantity = v_stock_quantity,
      stock_status = v_stock_status,
      low_stock_threshold = v_low_stock_threshold,
      updated_at = now()
    WHERE id = _product_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  END IF;
  RETURN v_id;
END;
$function$;

-- Reserve stock atomically as the order is inserted, before a Razorpay payment session is returned.
CREATE OR REPLACE FUNCTION public.reserve_physical_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  IF NEW.product_type <> 'physical' THEN RETURN NEW; END IF;
  IF NEW.product_id IS NULL THEN RAISE EXCEPTION 'This physical product is no longer available.'; END IF;

  SELECT * INTO v_product FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF NOT FOUND OR v_product.product_type <> 'physical' OR NOT v_product.is_active THEN
    RAISE EXCEPTION 'This physical product is no longer available.';
  END IF;
  IF v_product.stock_status <> 'in_stock' OR v_product.stock_quantity < NEW.quantity THEN
    RAISE EXCEPTION 'OUT_OF_STOCK: This item does not have enough stock for your order.';
  END IF;

  UPDATE public.products
  SET stock_quantity = stock_quantity - NEW.quantity,
      stock_status = CASE WHEN stock_quantity - NEW.quantity <= 0 THEN 'out_of_stock' ELSE stock_status END,
      updated_at = now()
  WHERE id = NEW.product_id;

  NEW.inventory_reserved := true;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS reserve_physical_product_stock_trigger ON public.orders;
CREATE TRIGGER reserve_physical_product_stock_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.reserve_physical_product_stock();

-- Mark reservation as consumed on successful payment; it is not deducted a second time.
CREATE OR REPLACE FUNCTION public.settle_physical_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.product_type <> 'physical' OR NOT NEW.inventory_reserved THEN RETURN NEW; END IF;

  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'verified' THEN
    NEW.inventory_deducted := true;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Cancelled' AND NOT OLD.inventory_released THEN
    IF OLD.inventory_reserved THEN
      UPDATE public.products
      SET stock_quantity = stock_quantity + OLD.quantity,
          stock_status = 'in_stock',
          updated_at = now()
      WHERE id = OLD.product_id AND product_type = 'physical';
      NEW.inventory_released := true;
      NEW.inventory_reserved := false;
      NEW.inventory_deducted := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS settle_physical_product_stock_trigger ON public.orders;
CREATE TRIGGER settle_physical_product_stock_trigger
BEFORE UPDATE OF payment_status, status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.settle_physical_product_stock();

REVOKE ALL ON FUNCTION public.reserve_physical_product_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_physical_product_stock() FROM PUBLIC, anon, authenticated;

COMMIT;
