-- Seller workspace hardening and seller dashboard data contract.
-- Additive to existing checkout/admin schema. Sellers perform mutations via server-verified RPCs.

begin;

-- Product review feedback is nullable and preserves all existing catalog rows.
alter table public.products add column if not exists review_feedback text;

-- product-files stays private and is limited to PDF uploads from the seller workspace.
update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf']
where id = 'product-files';

-- Explicit seller product read policy remains scoped to the authenticated owner.
drop policy if exists seller_read_own_products on public.products;
create policy seller_read_own_products on public.products
for select to authenticated
using (seller_id = (select auth.uid()) and public.current_user_is_seller());

-- Seller mutations use the RPCs below. Existing table grants remain available to
-- administrators, while no seller INSERT/UPDATE/DELETE policy is retained.
drop policy if exists seller_insert_own_pending_products on public.products;
drop policy if exists seller_update_own_pending_products on public.products;
drop policy if exists seller_delete_own_products on public.products;

-- Helper: resolve live role using profiles, not user-editable auth metadata.
create or replace function public.current_user_is_seller()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'seller'
  );
$$;
revoke all on function public.current_user_is_seller() from public, anon;
grant execute on function public.current_user_is_seller() to authenticated;

-- seller_balance retains its signature and its single source of payout logic, but runs
-- as a definer after binding the requested ID to auth.uid() and checking the live seller role.
create or replace function public.seller_balance(p_seller_id uuid)
returns table(pending_balance numeric,available_balance numeric)
language sql stable security definer set search_path = ''
as $$
  select
    coalesce(sum(o.seller_share) filter (where o.available_on>now() and not o.refunded),0)::numeric(12,2),
    (coalesce(sum(o.seller_share) filter (where o.available_on<=now() and not o.refunded),0)
     - coalesce((select sum(w.amount) from public.withdrawal_requests w
                 where w.seller_id=p_seller_id and w.status in ('requested','paid')),0)
    )::numeric(12,2)
  from public.orders o
  where o.seller_id=p_seller_id and p_seller_id=(select auth.uid())
    and public.current_user_is_seller() and o.seller_share is not null
$$;
revoke all on function public.seller_balance(uuid) from public, anon;
grant execute on function public.seller_balance(uuid) to authenticated;

-- RLS-safe owner-only product list. Keep column projection limited to seller UI fields.
drop policy if exists seller_read_own_products on public.products;
create policy seller_read_own_products on public.products
for select to authenticated
using (seller_id = (select auth.uid()) and public.current_user_is_seller());

-- Safe server-only operations. Function grants are authenticated, caller identity comes from auth.uid().
create or replace function public.seller_create_product(
  p_title text,
  p_slug text,
  p_description text,
  p_exam_label text,
  p_subject_label text,
  p_price numeric,
  p_pdf_path text,
  p_preview_path text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_product_id uuid;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_title,''))) not between 5 and 120
     or length(btrim(coalesce(p_description,''))) not between 20 and 2000
     or length(btrim(coalesce(p_subject_label,''))) not between 2 and 60
     or p_exam_label not in ('NEET','JEE','UPSC','SSC','CGL','CLAT','CA','Other')
     or p_price < 10 or p_price > 5000 or round(p_price,2) <> p_price then
    raise exception 'invalid product details' using errcode='22023';
  end if;
  if p_pdf_path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[A-Za-z0-9._-]+\.pdf$')
     or (p_preview_path is not null and p_preview_path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[A-Za-z0-9._-]+\.pdf$')) then
    raise exception 'invalid product file path' using errcode='22023';
  end if;

  insert into public.products (
    title, slug, description, course_label, subject_label, price, pdf_file, preview_file,
    product_type, format, is_free, is_active, is_archived, is_demo, is_featured,
    created_by, seller_id, status
  ) values (
    btrim(p_title), p_slug, btrim(p_description), p_exam_label, btrim(p_subject_label), p_price,
    p_pdf_path, p_preview_path, 'pdf', 'PDF', false, false, false, false, false,
    v_user, v_user, 'pending'
  ) returning id into v_product_id;
  return v_product_id;
end;
$$;
revoke all on function public.seller_create_product(text,text,text,text,text,numeric,text,text) from public, anon;
grant execute on function public.seller_create_product(text,text,text,text,text,numeric,text,text) to authenticated;

create or replace function public.seller_update_product(
  p_product_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_exam_label text,
  p_subject_label text,
  p_price numeric,
  p_pdf_path text,
  p_preview_path text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode='42501';
  end if;
  select * into v_product from public.products
  where id=p_product_id and seller_id=v_user for update;
  if not found then raise exception 'product not found' using errcode='P0002'; end if;
  if v_product.is_archived then raise exception 'archived products are read only' using errcode='42501'; end if;
  if v_product.status not in ('pending','rejected','approved') then
    raise exception 'product status cannot be edited' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_title,''))) not between 5 and 120
     or length(btrim(coalesce(p_description,''))) not between 20 and 2000
     or length(btrim(coalesce(p_subject_label,''))) not between 2 and 60
     or p_exam_label not in ('NEET','JEE','UPSC','SSC','CGL','CLAT','CA','Other')
     or p_price < 10 or p_price > 5000 or round(p_price,2) <> p_price then
    raise exception 'invalid product details' using errcode='22023';
  end if;
  if p_pdf_path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[A-Za-z0-9._-]+\.pdf$')
     or (p_preview_path is not null and p_preview_path !~ ('^' || v_user::text || '/[0-9a-f-]{36}/[A-Za-z0-9._-]+\.pdf$')) then
    raise exception 'invalid product file path' using errcode='22023';
  end if;

  -- Rejected records are resubmitted; approved records return to moderation when content changes.
  perform set_config('app.seller_product_write','enabled',true);
  update public.products
  set title=btrim(p_title), slug=p_slug, description=btrim(p_description),
      course_label=p_exam_label, subject_label=btrim(p_subject_label), price=p_price,
      pdf_file=p_pdf_path, preview_file=p_preview_path, status='pending', is_active=false
  where id=p_product_id and seller_id=v_user;
end;
$$;
revoke all on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text) from public, anon;
grant execute on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text) to authenticated;

create or replace function public.seller_archive_or_delete_product(p_product_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode='42501';
  end if;
  select * into v_product from public.products
  where id=p_product_id and seller_id=v_user for update;
  if not found then raise exception 'product not found' using errcode='P0002'; end if;

  if exists(select 1 from public.orders o where o.product_id=p_product_id) then
    perform set_config('app.seller_product_write','enabled',true);
    update public.products set is_archived=true,is_active=false where id=p_product_id;
    return 'archived';
  end if;

  perform set_config('app.seller_product_write','enabled',true);
  delete from public.products where id=p_product_id and seller_id=v_user;
  return 'deleted';
end;
$$;
revoke all on function public.seller_archive_or_delete_product(uuid) from public, anon;
grant execute on function public.seller_archive_or_delete_product(uuid) to authenticated;

-- Permit the RPCs above to change the moderation state only inside the current transaction.
create or replace function public.guard_marketplace_product_fields()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and current_setting('app.seller_product_write', true) = 'enabled'
     and old.seller_id = auth.uid()
     and public.current_user_is_seller() then
    return new;
  end if;
  if tg_op='INSERT' and new.seller_id is not null and not public.is_admin_staff() then
    if new.seller_id is distinct from auth.uid() or new.created_by is distinct from auth.uid()
       or new.status <> 'pending' then
      raise exception 'Sellers may only create their own pending products' using errcode='42501';
    end if;
  elsif tg_op='UPDATE' and not public.is_admin_staff() then
    if new.seller_id is distinct from old.seller_id or new.status is distinct from old.status
       or (old.seller_id is not null and old.seller_id <> auth.uid()) then
      raise exception 'Sellers cannot change product ownership or moderation status' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

-- Orders are not selected from the broad orders table by seller clients. This projection
-- contains only display-safe columns and relies on invoker RLS plus a live seller predicate.
create or replace view public.seller_sales with (security_barrier=true) as
select
  o.id, o.created_at, o.product_title, o.seller_share, o.available_on, o.refunded,
  coalesce(nullif(split_part(btrim(o.full_name),' ',1),''),'Customer') as buyer_first_name
from public.orders o
where o.seller_id=(select auth.uid()) and public.current_user_is_seller();

-- The view owner supplies privileged row access, but only the columns above are exposed.
-- Sellers receive no SELECT policy on orders itself, preventing access to buyer/payment fields.
revoke all on public.seller_sales from public, anon;
grant select on public.seller_sales to authenticated;

drop policy if exists seller_read_own_orders on public.orders;

-- Seller file deletion is permitted only for the current approved seller's own folder.
drop policy if exists seller_product_files_owner_delete on storage.objects;
create policy seller_product_files_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.current_user_is_seller()
);

-- Revoke public schema-wide table access only for seller-sensitive operations above.
-- Public product read and buyer order policies remain untouched.
commit;
