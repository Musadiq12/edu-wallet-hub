ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_images text[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS seller_product_covers_insert ON storage.objects;
CREATE POLICY seller_product_covers_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-covers'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
  AND public.current_user_is_seller()
  AND name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)

DROP POLICY IF EXISTS seller_product_covers_delete ON storage.objects;
CREATE POLICY seller_product_covers_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-covers'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
  AND public.current_user_is_seller()
  AND name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)

CREATE OR REPLACE FUNCTION public.seller_set_product_images(
  p_product_id uuid,
  p_product_images text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_target_id uuid;
BEGIN
  IF v_user IS NULL OR NOT public.current_user_is_seller() THEN
    RAISE EXCEPTION 'seller access required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND seller_id = v_user
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING errcode = 'P0002';
  END IF;

  IF coalesce(array_length(p_product_images, 1), 0) > 7
     OR EXISTS (
       SELECT 1
       FROM unnest(coalesce(p_product_images, '{}'::text[])) AS images(path)
       WHERE images.path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)$')
     ) THEN
    RAISE EXCEPTION 'invalid product image paths' USING errcode = '22023';
  END IF;

  IF v_product.status IN ('approved', 'published') THEN
    SELECT id INTO v_target_id
    FROM public.products
    WHERE seller_id = v_user
      AND revision_of = p_product_id
      AND status = 'pending'
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_target_id IS NULL THEN
      RAISE EXCEPTION 'pending product revision not found' USING errcode = 'P0002';
    END IF;
  ELSE
    v_target_id := p_product_id;
  END IF;

  PERFORM set_config('app.seller_product_write', 'enabled', true);
  UPDATE public.products
  SET product_images = coalesce(p_product_images, '{}'::text[]),
      updated_at = now()
  WHERE id = v_target_id
    AND seller_id = v_user;

  RETURN v_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_set_product_images(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_set_product_images(uuid, text[]) TO authenticated;
)
);

DROP POLICY IF EXISTS seller_product_covers_delete ON storage.objects;
CREATE POLICY seller_product_covers_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-covers'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
  AND public.current_user_is_seller()
);

CREATE OR REPLACE FUNCTION public.seller_set_product_images(
  p_product_id uuid,
  p_product_images text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_target_id uuid;
BEGIN
  IF v_user IS NULL OR NOT public.current_user_is_seller() THEN
    RAISE EXCEPTION 'seller access required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND seller_id = v_user
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING errcode = 'P0002';
  END IF;

  IF coalesce(array_length(p_product_images, 1), 0) > 7
     OR EXISTS (
       SELECT 1
       FROM unnest(coalesce(p_product_images, '{}'::text[])) AS images(path)
       WHERE images.path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)$')
     ) THEN
    RAISE EXCEPTION 'invalid product image paths' USING errcode = '22023';
  END IF;

  IF v_product.status IN ('approved', 'published') THEN
    SELECT id INTO v_target_id
    FROM public.products
    WHERE seller_id = v_user
      AND revision_of = p_product_id
      AND status = 'pending'
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_target_id IS NULL THEN
      RAISE EXCEPTION 'pending product revision not found' USING errcode = 'P0002';
    END IF;
  ELSE
    v_target_id := p_product_id;
  END IF;

  PERFORM set_config('app.seller_product_write', 'enabled', true);
  UPDATE public.products
  SET product_images = coalesce(p_product_images, '{}'::text[]),
      updated_at = now()
  WHERE id = v_target_id
    AND seller_id = v_user;

  RETURN v_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_set_product_images(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_set_product_images(uuid, text[]) TO authenticated;
)
);

CREATE OR REPLACE FUNCTION public.seller_set_product_images(
  p_product_id uuid,
  p_product_images text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_target_id uuid;
BEGIN
  IF v_user IS NULL OR NOT public.current_user_is_seller() THEN
    RAISE EXCEPTION 'seller access required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND seller_id = v_user
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING errcode = 'P0002';
  END IF;

  IF coalesce(array_length(p_product_images, 1), 0) > 7
     OR EXISTS (
       SELECT 1
       FROM unnest(coalesce(p_product_images, '{}'::text[])) AS images(path)
       WHERE images.path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)$')
     ) THEN
    RAISE EXCEPTION 'invalid product image paths' USING errcode = '22023';
  END IF;

  IF v_product.status IN ('approved', 'published') THEN
    SELECT id INTO v_target_id
    FROM public.products
    WHERE seller_id = v_user
      AND revision_of = p_product_id
      AND status = 'pending'
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_target_id IS NULL THEN
      RAISE EXCEPTION 'pending product revision not found' USING errcode = 'P0002';
    END IF;
  ELSE
    v_target_id := p_product_id;
  END IF;

  PERFORM set_config('app.seller_product_write', 'enabled', true);
  UPDATE public.products
  SET product_images = coalesce(p_product_images, '{}'::text[]),
      updated_at = now()
  WHERE id = v_target_id
    AND seller_id = v_user;

  RETURN v_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_set_product_images(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_set_product_images(uuid, text[]) TO authenticated;
)
);

DROP POLICY IF EXISTS seller_product_covers_delete ON storage.objects;
CREATE POLICY seller_product_covers_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-covers'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
  AND public.current_user_is_seller()
);

CREATE OR REPLACE FUNCTION public.seller_set_product_images(
  p_product_id uuid,
  p_product_images text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_target_id uuid;
BEGIN
  IF v_user IS NULL OR NOT public.current_user_is_seller() THEN
    RAISE EXCEPTION 'seller access required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND seller_id = v_user
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found' USING errcode = 'P0002';
  END IF;

  IF coalesce(array_length(p_product_images, 1), 0) > 7
     OR EXISTS (
       SELECT 1
       FROM unnest(coalesce(p_product_images, '{}'::text[])) AS images(path)
       WHERE images.path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)$')
     ) THEN
    RAISE EXCEPTION 'invalid product image paths' USING errcode = '22023';
  END IF;

  IF v_product.status IN ('approved', 'published') THEN
    SELECT id INTO v_target_id
    FROM public.products
    WHERE seller_id = v_user
      AND revision_of = p_product_id
      AND status = 'pending'
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_target_id IS NULL THEN
      RAISE EXCEPTION 'pending product revision not found' USING errcode = 'P0002';
    END IF;
  ELSE
    v_target_id := p_product_id;
  END IF;

  PERFORM set_config('app.seller_product_write', 'enabled', true);
  UPDATE public.products
  SET product_images = coalesce(p_product_images, '{}'::text[]),
      updated_at = now()
  WHERE id = v_target_id
    AND seller_id = v_user;

  RETURN v_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_set_product_images(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_set_product_images(uuid, text[]) TO authenticated;
