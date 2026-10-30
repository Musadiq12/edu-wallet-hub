-- Product review lifecycle v2. Keep legacy/admin products intact; seller rows receive the expanded state machine.
begin;

alter table public.products
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists admin_notes text,
  add column if not exists revision_of uuid references public.products(id) on delete set null,
  add column if not exists deleted_at timestamptz;

-- Keep old status labels for legacy admin-managed catalog rows; seller products use the new canonical values.
alter table public.products drop constraint if exists products_marketplace_status_check;
alter table public.products add constraint products_marketplace_status_check
  check (
    (seller_id is null and status in ('pending','approved','rejected'))
    or (seller_id is not null and status in ('pending','published','rejected','unpublished'))
  ) not valid;
alter table public.products validate constraint products_marketplace_status_check;

update public.products
set submitted_at=coalesce(submitted_at,created_at)
where seller_id is not null;

update public.products
set status=case when is_active and not is_archived then 'published' else 'unpublished' end,
    published_at=case when is_active and not is_archived then coalesce(published_at,created_at) else published_at end
where seller_id is not null and status='approved';

create index if not exists products_seller_review_queue_idx
  on public.products(status,submitted_at) where seller_id is not null and deleted_at is null;
create index if not exists products_revision_of_idx on public.products(revision_of) where revision_of is not null;

-- The original seller RPCs are replaced so all status changes happen through this database transition function.
create or replace function public.transition_seller_product(
  p_product_id uuid,
  p_action text,
  p_reason text default null,
  p_admin_notes text default null
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_product public.products%rowtype;
  v_updated public.products%rowtype;
  v_new_status text;
begin
  if v_admin is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode='42501';
  end if;
  if p_action not in ('approve','reject','unpublish','republish','save_notes') then
    raise exception 'invalid moderation action' using errcode='22023';
  end if;
  select * into v_product from public.products
    where id=p_product_id and seller_id is not null and deleted_at is null for update;
  if not found then raise exception 'seller product not found' using errcode='P0002'; end if;

  if p_action='save_notes' then
    update public.products set admin_notes=nullif(left(btrim(coalesce(p_admin_notes,'')),4000),''),
      updated_at=now() where id=p_product_id returning * into v_updated;
    return v_updated;
  end if;

  v_new_status := case p_action
    when 'approve' then 'published'
    when 'reject' then 'rejected'
    when 'unpublish' then 'unpublished'
    when 'republish' then 'published'
  end;

  if (p_action='approve' and v_product.status<>'pending')
     or (p_action='reject' and v_product.status<>'pending')
     or (p_action='unpublish' and v_product.status<>'published')
     or (p_action='republish' and v_product.status<>'unpublished') then
    raise exception 'invalid product status transition' using errcode='22023';
  end if;
  if p_action='reject' and length(btrim(coalesce(p_reason,'')))<10 then
    raise exception 'Rejection reason must contain at least 10 characters' using errcode='22023';
  end if;

  if p_action='approve' and v_product.revision_of is not null then
    update public.products
    set title=v_product.title,slug=v_product.slug,description=v_product.description,
        whats_included=v_product.whats_included,course_label=v_product.course_label,
        subject_label=v_product.subject_label,keywords=v_product.keywords,price=v_product.price,
        discounted_price=v_product.discounted_price,cover_image=v_product.cover_image,
        pdf_file=v_product.pdf_file,preview_file=v_product.preview_file,page_count=v_product.page_count,
        format=v_product.format,is_free=v_product.is_free,product_type=v_product.product_type,
        stock_quantity=v_product.stock_quantity,stock_status=v_product.stock_status,
        is_active=true,is_archived=false,updated_at=now()
    where id=v_product.revision_of and seller_id=v_product.seller_id and status='published';
    if not found then raise exception 'live product revision target is not published' using errcode='22023'; end if;
  end if;

  update public.products
  set status=v_new_status,
      is_active=(v_new_status='published'),
      is_archived=false,
      reviewed_at=now(),
      reviewed_by=v_admin,
      published_at=case when v_new_status='published' then coalesce(published_at,now()) else published_at end,
      rejection_reason=case when v_new_status='rejected' then left(btrim(p_reason),1000) else null end,
      review_feedback=case when v_new_status='rejected' then left(btrim(p_reason),1000) else null end,
      updated_at=now()
  where id=p_product_id returning * into v_updated;

  insert into public.admin_activity_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(v_admin,'seller_product_'||p_action,'product',p_product_id,
    jsonb_build_object('status',v_product.status),
    jsonb_build_object('status',v_updated.status,'reason',v_updated.rejection_reason,'revision_of',v_updated.revision_of));

  return v_updated;
end;
$$;
revoke all on function public.transition_seller_product(uuid,text,text,text) from public,anon;
grant execute on function public.transition_seller_product(uuid,text,text,text) to authenticated;

-- Compatibility function used by existing admin review UI; it delegates all status changes centrally.
create or replace function public.admin_review_seller_product(
  p_product_id uuid,p_status text,p_review_feedback text default null
)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if p_status='approved' then
    perform public.transition_seller_product(p_product_id,'approve',null,null);
  elsif p_status='rejected' then
    perform public.transition_seller_product(p_product_id,'reject',p_review_feedback,null);
  else
    raise exception 'status must be approved or rejected' using errcode='22023';
  end if;
end;
$$;
revoke all on function public.admin_review_seller_product(uuid,text,text) from public,anon;
grant execute on function public.admin_review_seller_product(uuid,text,text) to authenticated;

-- Make product transitions impossible through direct table updates by ordinary users.
-- Existing admin table policies remain, but status updates are reserved for the transition RPC.
create or replace function public.guard_marketplace_product_fields()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if tg_op='UPDATE' and old.seller_id is not null and new.status is distinct from old.status
     and current_setting('app.marketplace_transition',true) is distinct from 'enabled' then
    raise exception 'Use the product review transition function to change seller product status' using errcode='42501';
  end if;
  if tg_op='UPDATE' and current_setting('app.seller_product_write',true)='enabled'
     and old.seller_id=auth.uid() and public.current_user_is_seller() then
    return new;
  end if;
  if tg_op='INSERT' and new.seller_id is not null and not public.is_admin_staff() then
    if new.seller_id is distinct from auth.uid() or new.created_by is distinct from auth.uid()
       or new.status<>'pending' then
      raise exception 'Sellers may only create their own pending products' using errcode='42501';
    end if;
  elsif tg_op='UPDATE' and not public.is_admin_staff() then
    if new.seller_id is distinct from old.seller_id or new.status is distinct from old.status
       or (old.seller_id is not null and old.seller_id<>auth.uid()) then
      raise exception 'Sellers cannot change product ownership or moderation status' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

-- Ensure the central transition function sets its transaction-local capability before its only status update.
create or replace function public.transition_seller_product(
  p_product_id uuid,p_action text,p_reason text default null,p_admin_notes text default null
)
returns public.products language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid:=auth.uid();
  v_product public.products%rowtype;
  v_updated public.products%rowtype;
  v_new_status text;
begin
  if v_admin is null or not public.is_admin_staff() then raise exception 'administrator access required' using errcode='42501'; end if;
  if p_action not in ('approve','reject','unpublish','republish','save_notes') then raise exception 'invalid moderation action' using errcode='22023'; end if;
  select * into v_product from public.products where id=p_product_id and seller_id is not null and deleted_at is null for update;
  if not found then raise exception 'seller product not found' using errcode='P0002'; end if;
  if p_action='save_notes' then
    update public.products set admin_notes=nullif(left(btrim(coalesce(p_admin_notes,'')),4000),''),updated_at=now()
    where id=p_product_id returning * into v_updated;
    return v_updated;
  end if;
  v_new_status:=case p_action when 'approve' then 'published' when 'reject' then 'rejected' when 'unpublish' then 'unpublished' when 'republish' then 'published' end;
  if (p_action='approve' and v_product.status<>'pending') or (p_action='reject' and v_product.status<>'pending')
    or (p_action='unpublish' and v_product.status<>'published') or (p_action='republish' and v_product.status<>'unpublished') then
    raise exception 'invalid product status transition' using errcode='22023';
  end if;
  if p_action='reject' and length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Rejection reason must contain at least 10 characters' using errcode='22023'; end if;

  if p_action='approve' and v_product.revision_of is not null then
    update public.products set title=v_product.title,slug=v_product.slug,description=v_product.description,
      whats_included=v_product.whats_included,course_label=v_product.course_label,subject_label=v_product.subject_label,
      keywords=v_product.keywords,price=v_product.price,discounted_price=v_product.discounted_price,cover_image=v_product.cover_image,
      pdf_file=v_product.pdf_file,preview_file=v_product.preview_file,page_count=v_product.page_count,format=v_product.format,
      is_free=v_product.is_free,product_type=v_product.product_type,stock_quantity=v_product.stock_quantity,
      stock_status=v_product.stock_status,is_active=true,is_archived=false,updated_at=now()
    where id=v_product.revision_of and seller_id=v_product.seller_id and status='published';
    if not found then raise exception 'live product revision target is not published' using errcode='22023'; end if;
  end if;

  perform set_config('app.marketplace_transition','enabled',true);
  update public.products set status=v_new_status,is_active=(v_new_status='published'),is_archived=false,
    reviewed_at=now(),reviewed_by=v_admin,
    published_at=case when v_new_status='published' then coalesce(published_at,now()) else published_at end,
    rejection_reason=case when v_new_status='rejected' then left(btrim(p_reason),1000) else null end,
    review_feedback=case when v_new_status='rejected' then left(btrim(p_reason),1000) else null end,
    updated_at=now()
  where id=p_product_id returning * into v_updated;
  insert into public.admin_activity_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(v_admin,'seller_product_'||p_action,'product',p_product_id,jsonb_build_object('status',v_product.status),
    jsonb_build_object('status',v_updated.status,'reason',v_updated.rejection_reason,'revision_of',v_updated.revision_of));
  return v_updated;
end;
$$;
revoke all on function public.transition_seller_product(uuid,text,text,text) from public,anon;
grant execute on function public.transition_seller_product(uuid,text,text,text) to authenticated;

-- Admin general product list and public queries use status; legacy product statuses are preserved through is_active.
drop policy if exists marketplace_public_read_approved_products on public.products;
create policy marketplace_public_read_approved_products on public.products
for select to anon,authenticated
using (
  (seller_id is null and status='approved' and is_active=true and not is_archived and deleted_at is null)
  or (seller_id is not null and status='published' and is_active=true and not is_archived and deleted_at is null)
  or public.is_admin_staff()
  or (seller_id=(select auth.uid()))
);

-- Private storage files remain inaccessible publicly; the owner and admin policies are kept.
commit;
