-- Upgrade the existing legacy coupons table in place; preserve all existing rows.
CREATE TYPE public.coupon_discount_type AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');
CREATE TYPE public.coupon_status AS ENUM ('DRAFT', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'DISABLED');
CREATE TYPE public.coupon_target_type AS ENUM ('PRODUCT', 'VARIANT', 'CATEGORY', 'BRAND', 'ALL_PRODUCTS');
CREATE TYPE public.coupon_target_mode AS ENUM ('INCLUDE', 'EXCLUDE');

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  public_label text,
  discount_type public.coupon_discount_type NOT NULL DEFAULT 'PERCENTAGE',
  discount_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  max_discount_amount numeric(12,2) CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
  min_subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  min_item_quantity integer NOT NULL DEFAULT 1 CHECK (min_item_quantity >= 1),
  starts_at timestamptz,
  ends_at timestamptz,
  total_usage_limit integer CHECK (total_usage_limit IS NULL OR total_usage_limit >= 1),
  per_customer_limit integer NOT NULL DEFAULT 1 CHECK (per_customer_limit >= 1),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  first_order_only boolean NOT NULL DEFAULT false,
  stackable boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  status public.coupon_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  usage_limit integer,
  is_active boolean NOT NULL DEFAULT true,
);

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS public_label text;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_discount_amount numeric(12,2);
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS min_subtotal numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS min_item_quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS total_usage_limit integer;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS per_customer_limit integer NOT NULL DEFAULT 1;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS first_order_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS stackable boolean NOT NULL DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS status public.coupon_status NOT NULL DEFAULT 'DRAFT';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS usage_limit integer;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Normalize the legacy enum values without deleting or replacing any coupon rows.
ALTER TABLE public.coupons ALTER COLUMN discount_type DROP DEFAULT;
ALTER TABLE public.coupons ALTER COLUMN discount_type TYPE public.coupon_discount_type
USING CASE
  WHEN lower(discount_type::text) IN ('percent','percentage') THEN 'PERCENTAGE'::public.coupon_discount_type
  WHEN lower(discount_type::text) IN ('free_shipping','freeshipping') THEN 'FREE_SHIPPING'::public.coupon_discount_type
  ELSE 'FIXED_AMOUNT'::public.coupon_discount_type
END;
ALTER TABLE public.coupons ALTER COLUMN discount_type SET DEFAULT 'PERCENTAGE';
UPDATE public.coupons SET ends_at = COALESCE(ends_at, expires_at), total_usage_limit = COALESCE(total_usage_limit, usage_limit);
UPDATE public.coupons SET status = CASE
  WHEN is_active = false THEN 'DISABLED'::public.coupon_status
  WHEN COALESCE(ends_at, expires_at) IS NOT NULL AND COALESCE(ends_at, expires_at) <= now() THEN 'EXPIRED'::public.coupon_status
  WHEN status = 'DRAFT' THEN 'ACTIVE'::public.coupon_status
  ELSE status
END;
DO $ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_min_subtotal_check CHECK (min_subtotal >= 0) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_min_item_quantity_check CHECK (min_item_quantity >= 1) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_total_usage_limit_check CHECK (total_usage_limit IS NULL OR total_usage_limit >= 1) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_per_customer_limit_check CHECK (per_customer_limit >= 1) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $;
DO $ BEGIN ALTER TABLE public.coupons ADD CONSTRAINT coupons_valid_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at) NOT VALID; EXCEPTION WHEN duplicate_object THEN NULL; END $;
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_case_insensitive_idx ON public.coupons (upper(trim(code)));
CREATE INDEX IF NOT EXISTS coupons_status_window_idx ON public.coupons(status, starts_at, ends_at);

DO $function$ BEGIN
  ALTER TABLE public.coupons ADD CONSTRAINT coupons_value_valid CHECK (
    (discount_type = 'PERCENTAGE' AND discount_value > 0 AND discount_value <= 100)
    OR (discount_type = 'FIXED_AMOUNT' AND discount_value > 0)
    OR (discount_type = 'FREE_SHIPPING' AND discount_value = 0)
  ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $function$;

CREATE TABLE IF NOT EXISTS public.coupon_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  target_type public.coupon_target_type NOT NULL,
  target_id uuid,
  mode public.coupon_target_mode NOT NULL DEFAULT 'INCLUDE',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_target_id_required CHECK ((target_type = 'ALL_PRODUCTS' AND target_id IS NULL) OR (target_type <> 'ALL_PRODUCTS' AND target_id IS NOT NULL)),
  CONSTRAINT coupon_target_unique UNIQUE (coupon_id, target_type, target_id, mode)
);
CREATE INDEX IF NOT EXISTS coupon_targets_coupon_idx ON public.coupon_targets(coupon_id);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  discount_applied numeric(12,2) NOT NULL CHECK (discount_applied >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_customer_idx ON public.coupon_redemptions(coupon_id, customer_id);

CREATE TABLE IF NOT EXISTS public.order_discount_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  discount_amount numeric(12,2) NOT NULL CHECK (discount_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, coupon_id, product_id)
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (coupon_discount >= 0);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_discount_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "admins manage coupons" ON public.coupons;
CREATE POLICY "admins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.is_admin_staff()) WITH CHECK (public.is_admin_staff());
DROP POLICY IF EXISTS "admins manage coupon targets" ON public.coupon_targets;
CREATE POLICY "admins manage coupon targets" ON public.coupon_targets FOR ALL TO authenticated
  USING (public.is_admin_staff()) WITH CHECK (public.is_admin_staff());
DROP POLICY IF EXISTS "admins read coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "admins read coupon redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (public.is_admin_staff());
DROP POLICY IF EXISTS "admins read discount allocations" ON public.order_discount_allocations;
CREATE POLICY "admins read discount allocations" ON public.order_discount_allocations FOR SELECT TO authenticated
  USING (public.is_admin_staff());

-- Validate the coupon on the server; public callers receive only a discount quote, never coupon/target listings.
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text, p_product_id uuid, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  c public.coupons%ROWTYPE;
  v_eligible boolean;
  v_excluded boolean;
  v_discount numeric(12,2);
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) < 3 OR length(trim(p_code)) > 64
     OR p_subtotal IS NULL OR p_subtotal < 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'COUPON_NOT_FOUND');
  END IF;

  SELECT * INTO c FROM public.coupons WHERE upper(trim(code)) = upper(trim(p_code));
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'error', 'COUPON_NOT_FOUND'); END IF;
  IF c.status NOT IN ('ACTIVE','SCHEDULED') OR (c.status = 'SCHEDULED' AND (c.starts_at IS NULL OR c.starts_at > now())) OR (c.starts_at IS NOT NULL AND c.starts_at > now()) OR (c.ends_at IS NOT NULL AND c.ends_at <= now()) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'COUPON_EXPIRED');
  END IF;
  IF c.total_usage_limit IS NOT NULL AND c.usage_count >= c.total_usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'USAGE_LIMIT_REACHED');
  END IF;
  IF p_subtotal < c.min_subtotal THEN RETURN jsonb_build_object('valid', false, 'error', 'MIN_SUBTOTAL_NOT_MET'); END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.coupon_targets t
    WHERE t.coupon_id = c.id AND t.mode = 'INCLUDE'
      AND (t.target_type = 'ALL_PRODUCTS'
        OR (t.target_type = 'PRODUCT' AND t.target_id = p_product_id)
        OR (t.target_type = 'CATEGORY' AND t.target_id = (SELECT category_id FROM public.products WHERE id = p_product_id)))
  ) INTO v_eligible;
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_targets t
    WHERE t.coupon_id = c.id AND t.mode = 'EXCLUDE'
      AND (t.target_type = 'ALL_PRODUCTS'
        OR (t.target_type = 'PRODUCT' AND t.target_id = p_product_id)
        OR (t.target_type = 'CATEGORY' AND t.target_id = (SELECT category_id FROM public.products WHERE id = p_product_id)))
  ) INTO v_excluded;
  IF NOT v_eligible OR v_excluded THEN RETURN jsonb_build_object('valid', false, 'error', 'NOT_ELIGIBLE_FOR_CART'); END IF;

  v_discount := CASE
    WHEN c.discount_type = 'PERCENTAGE' THEN round(least(p_subtotal, p_subtotal * c.discount_value / 100, COALESCE(c.max_discount_amount, p_subtotal)), 2)
    WHEN c.discount_type = 'FIXED_AMOUNT' THEN round(least(p_subtotal, c.discount_value), 2)
    ELSE 0
  END;
  RETURN jsonb_build_object('valid', true, 'couponId', c.id, 'code', c.code, 'label', c.public_label,
    'discountType', c.discount_type, 'discountValue', c.discount_value, 'discountAmount', v_discount,
    'total', greatest(0, round(p_subtotal - v_discount, 2)), 'stackable', c.stackable);
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_coupon(text, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO anon, authenticated;

-- A database trigger locks the coupon row during order creation, preventing concurrent over-redemption.
CREATE OR REPLACE FUNCTION public.consume_coupon_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  c public.coupons%ROWTYPE;
  v_quote jsonb;
  v_discount numeric(12,2);
  v_prior_orders integer;
BEGIN
  IF NEW.coupon_code IS NULL OR trim(NEW.coupon_code) = '' THEN
    NEW.coupon_discount := 0;
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL OR NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'Coupon requires an authenticated customer and product';
  END IF;

  SELECT * INTO c FROM public.coupons WHERE code = upper(trim(NEW.coupon_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COUPON_NOT_FOUND'; END IF;

  v_quote := public.validate_coupon(c.code, NEW.product_id, NEW.amount + COALESCE(NEW.coupon_discount, 0));
  IF NOT COALESCE((v_quote->>'valid')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_quote->>'error', 'NOT_ELIGIBLE_FOR_CART');
  END IF;
  IF c.per_customer_limit IS NOT NULL AND (
    SELECT count(*) FROM public.coupon_redemptions r WHERE r.coupon_id = c.id AND r.customer_id = NEW.user_id
  ) >= c.per_customer_limit THEN RAISE EXCEPTION 'USAGE_LIMIT_REACHED'; END IF;
  IF c.first_order_only THEN
    SELECT count(*) INTO v_prior_orders FROM public.orders o
      WHERE o.user_id = NEW.user_id AND o.payment_status <> 'cancelled';
    IF v_prior_orders > 0 THEN RAISE EXCEPTION 'NOT_ELIGIBLE_FOR_CART'; END IF;
  END IF;

  v_discount := round(COALESCE((v_quote->>'discountAmount')::numeric, 0), 2);
  NEW.coupon_code := c.code;
  NEW.coupon_discount := v_discount;
  NEW.amount := greatest(0, round(NEW.amount - v_discount, 2));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_coupon_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_coupon_id uuid;
BEGIN
  IF NEW.coupon_code IS NULL OR NEW.coupon_code = '' THEN RETURN NEW; END IF;
  SELECT id INTO v_coupon_id FROM public.coupons WHERE code = NEW.coupon_code;
  INSERT INTO public.coupon_redemptions(coupon_id, order_id, customer_id, discount_applied)
  VALUES (v_coupon_id, NEW.id, NEW.user_id, NEW.coupon_discount);
  INSERT INTO public.order_discount_allocations(order_id, product_id, coupon_id, discount_amount)
  VALUES (NEW.id, NEW.product_id, v_coupon_id, NEW.coupon_discount);
  UPDATE public.coupons SET usage_count = usage_count + 1, updated_at = now() WHERE id = v_coupon_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_consume_coupon_trigger ON public.orders;
CREATE TRIGGER orders_consume_coupon_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.consume_coupon_for_order();
DROP TRIGGER IF EXISTS orders_coupon_redemption_trigger ON public.orders;
CREATE TRIGGER orders_coupon_redemption_trigger
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_coupon_redemption();

COMMENT ON TABLE public.coupons IS 'Coupons are admin-managed. Discounts are validated and consumed server-side at order insertion.';
COMMENT ON COLUMN public.orders.coupon_discount IS 'Discount amount in currency minor units (INR rounded to paise) captured for refund allocation.';
