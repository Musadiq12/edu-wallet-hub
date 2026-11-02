-- Admin-owned products are not seller submissions and must use the approved
-- catalogue state when an administrator publishes them. Seller-created rows
-- retain the pending -> published moderation workflow.
CREATE OR REPLACE FUNCTION public.admin_upsert_product(_product_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_product_type text := COALESCE(NULLIF(_payload->>'product_type', ''), 'pdf');
  v_stock_quantity integer := 0;
  v_stock_status text := 'out_of_stock';
  v_low_stock_threshold integer := NULL;
  v_is_active boolean := COALESCE((_payload->>'is_active')::boolean, false);
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
      cover_image, product_images, pdf_file, preview_file, created_by,
      stock_quantity, stock_status, low_stock_threshold,
      status, published_at
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
      v_is_active,
      NULLIF(_payload->>'cover_image', ''),
      CASE WHEN v_product_type = 'pdf' THEN NULLIF(_payload->>'pdf_file', '') ELSE NULL END,
      CASE WHEN v_product_type = 'pdf' THEN NULLIF(_payload->>'preview_file', '') ELSE NULL END,
      auth.uid(),
      v_stock_quantity, v_stock_status, v_low_stock_threshold,
      'approved',
      CASE WHEN v_is_active THEN now() ELSE NULL END
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
      is_active = v_is_active,
      cover_image = NULLIF(_payload->>'cover_image', ''),
      pdf_file = CASE WHEN v_product_type = 'pdf' THEN NULLIF(_payload->>'pdf_file', '') ELSE NULL END,
      preview_file = CASE WHEN v_product_type = 'pdf' THEN NULLIF(_payload->>'preview_file', '') ELSE NULL END,
      stock_quantity = v_stock_quantity,
      stock_status = v_stock_status,
      low_stock_threshold = v_low_stock_threshold,
      status = 'approved',
      published_at = CASE WHEN v_is_active THEN COALESCE(published_at, now()) ELSE NULL END,
      updated_at = now()
    WHERE id = _product_id AND seller_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Admin-owned product not found'; END IF;
    v_id := _product_id;
  END IF;
  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_upsert_product(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_product(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product(uuid, jsonb) TO authenticated;

-- Existing legacy pending admin rows are exposed in the admin list after the
-- frontend query fix. Saving one through this authenticated admin RPC moves it
-- to approved. Seller-owned pending submissions remain untouched.
