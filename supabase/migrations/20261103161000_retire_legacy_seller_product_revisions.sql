-- Retire a pending revision created by the legacy seller edit workflow.
-- The canonical product remains intact; this only removes the obsolete review row.
create or replace function public.seller_retire_legacy_product_revision(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_revision public.products%rowtype;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode = '42501';
  end if;

  select * into v_revision
  from public.products
  where id = p_product_id
    and seller_id = v_user
    and status = 'pending'
    and revision_of is not null
    and deleted_at is null
  for update;

  if not found then
    raise exception 'pending legacy revision not found' using errcode = 'P0002';
  end if;

  perform set_config('app.seller_product_write', 'enabled', true);
  update public.products
  set deleted_at = now(), is_active = false, updated_at = now()
  where id = p_product_id and seller_id = v_user;

  return true;
end;
$function$;

revoke all on function public.seller_retire_legacy_product_revision(uuid) from public, anon;
grant execute on function public.seller_retire_legacy_product_revision(uuid) to authenticated;
