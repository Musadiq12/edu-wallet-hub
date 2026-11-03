-- Preserve seller gallery updates for the same-row edit workflow.
-- The RPC must target the product itself (not a legacy child row).
create or replace function public.seller_set_product_images(p_product_id uuid, p_product_images text[])
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode = '42501';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and seller_id = v_user and deleted_at is null
  for update;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if coalesce(array_length(p_product_images, 1), 0) > 7
     or exists (
       select 1
       from unnest(coalesce(p_product_images, '{}'::text[])) as images(path)
       where images.path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp|gif)$')
     ) then
    raise exception 'invalid product image paths' using errcode = '22023';
  end if;

  perform set_config('app.seller_gallery_write', 'enabled', true);
  perform set_config('app.seller_product_write', 'enabled', true);
  update public.products
  set product_images = coalesce(p_product_images, '{}'::text[]),
      updated_at = now()
  where id = p_product_id and seller_id = v_user;

  return p_product_id;
end;
$function$;

revoke all on function public.seller_set_product_images(uuid,text[]) from public, anon;
grant execute on function public.seller_set_product_images(uuid,text[]) to authenticated;
