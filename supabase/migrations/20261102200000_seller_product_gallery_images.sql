ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_images text[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS seller_product_covers_insert ON storage.objects;
CREATE POLICY seller_product_covers_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-covers'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
  AND public.current_user_is_seller()
  AND name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)$')
);

DROP POLICY IF EXISTS seller_product_covers_delete ON storage.objects;
CREATE POLICY seller_product_covers_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-covers'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
  AND public.current_user_is_seller()
  AND name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)$')
);

DROP POLICY IF EXISTS seller_update_own_product_gallery ON public.products;
CREATE POLICY seller_update_own_product_gallery ON public.products
FOR UPDATE TO authenticated
USING (seller_id = (select auth.uid()) AND public.current_user_is_seller())
WITH CHECK (seller_id = (select auth.uid()) AND public.current_user_is_seller());

CREATE OR REPLACE FUNCTION public.guard_marketplace_product_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
begin
  if tg_op='UPDATE' and old.seller_id is not null and new.status is distinct from old.status and current_setting('app.marketplace_transition',true) is distinct from 'enabled' then
    raise exception 'Product status must be changed through the marketplace transition function' using errcode='42501';
  end if;
  if tg_op='UPDATE' and old.seller_id is not null and new.admin_notes is distinct from old.admin_notes and current_setting('app.marketplace_transition',true) is distinct from 'enabled' then
    raise exception 'Internal notes can only be changed by administrators' using errcode='42501';
  end if;
  if tg_op='UPDATE'
     and current_setting('app.seller_gallery_write',true)='enabled'
     and old.seller_id=auth.uid()
     and public.current_user_is_seller()
     and new.status is not distinct from old.status
     and new.admin_notes is not distinct from old.admin_notes
     and (to_jsonb(new) - 'product_images' - 'updated_at') = (to_jsonb(old) - 'product_images' - 'updated_at') then
    return new;
  end if;
  if tg_op='UPDATE' and current_setting('app.seller_product_write',true)='enabled' and old.seller_id=auth.uid() and public.current_user_is_seller() and new.status is not distinct from old.status and new.admin_notes is not distinct from old.admin_notes then
    return new;
  end if;
  if tg_op='INSERT' and new.seller_id is not null and not public.is_admin_staff() then
    if new.seller_id is distinct from auth.uid() or new.created_by is distinct from auth.uid() or new.status<>'pending' then
      raise exception 'Sellers may only create their own pending products' using errcode='42501';
    end if;
  elsif tg_op='UPDATE' and not public.is_admin_staff() then
    if new.seller_id is distinct from old.seller_id or new.status is distinct from old.status or (old.seller_id is not null and old.seller_id<>auth.uid()) then
      raise exception 'Sellers cannot change product ownership or moderation status' using errcode='42501';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.seller_set_product_images(
  p_product_id uuid,
  p_product_images text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
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

  PERFORM set_config('app.seller_gallery_write', 'enabled', true);
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
