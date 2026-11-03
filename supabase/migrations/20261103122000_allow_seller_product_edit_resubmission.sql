-- Permit the seller edit RPC to resubmit the seller's own product row for moderation.
-- Ownership remains immutable; only the trusted seller_update_product RPC sets this transaction-local flag.
create or replace function public.guard_marketplace_product_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op='UPDATE' and old.seller_id is not null and new.status is distinct from old.status
     and current_setting('app.marketplace_transition',true) is distinct from 'enabled'
     and not (
       current_setting('app.seller_product_write',true)='enabled'
       and old.seller_id=auth.uid()
       and public.current_user_is_seller()
       and new.seller_id is not distinct from old.seller_id
       and new.created_by is not distinct from old.created_by
       and new.status='pending'
       and new.admin_notes is not distinct from old.admin_notes
     ) then
    raise exception 'Product status must be changed through the marketplace transition function' using errcode='42501';
  end if;
  if tg_op='UPDATE' and old.seller_id is not null and new.admin_notes is distinct from old.admin_notes
     and current_setting('app.marketplace_transition',true) is distinct from 'enabled' then
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
  if tg_op='UPDATE'
     and current_setting('app.seller_product_write',true)='enabled'
     and old.seller_id=auth.uid()
     and public.current_user_is_seller()
     and new.seller_id is not distinct from old.seller_id
     and new.created_by is not distinct from old.created_by
     and new.admin_notes is not distinct from old.admin_notes
     and (
       new.status is not distinct from old.status
       or new.status='pending'
     ) then
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
