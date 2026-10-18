ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'pdf';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_product_type_check
  CHECK (product_type IN ('pdf', 'physical'));

UPDATE public.products
SET product_type = 'pdf'
WHERE product_type IS NULL OR product_type NOT IN ('pdf', 'physical');

CREATE OR REPLACE FUNCTION public.admin_upsert_product(_product_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_product_type text := COALESCE(NULLIF(_payload->>'product_type', ''), 'pdf');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_product_type NOT IN ('pdf', 'physical') THEN
    RAISE EXCEPTION 'Invalid product type';
  END IF;

  IF v_product_type = 'physical' AND (
    NULLIF(_payload->>'pdf_file', '') IS NOT NULL OR
    NULLIF(_payload->>'preview_file', '') IS NOT NULL
  ) THEN
    -- Physical products are not delivered as downloadable files.
    NULL;
  END IF;

  IF _product_id IS NULL THEN
    INSERT INTO public.products (
      product_type, title, slug, description, whats_included, category_id,
      course_label, subject_label, keywords, price, discounted_price,
      page_count, format, is_free, is_featured, is_active,
      cover_image, pdf_file, preview_file, created_by
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
      auth.uid()
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
      updated_at = now()
    WHERE id = _product_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;
