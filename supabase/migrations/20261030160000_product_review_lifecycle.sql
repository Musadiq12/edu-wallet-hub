-- Seller product review lifecycle. This migration intentionally preserves legacy admin catalogue rows.
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

-- Legacy catalogue products keep the legacy labels. Seller products use the canonical review states.
alter table public.products drop constraint if exists products_marketplace_status_check;
alter table public.products add constraint products_marketplace_status_check check (
  (seller_id is null and status in ('pending','approved','rejected'))
  or (seller_id is not null and status in ('pending','published','rejected','unpublished'))
) not valid;
alter table public.products validate constraint products_marketplace_status_check;

update public.products set submitted_at=coalesce(submitted_at,created_at)
where seller_id is not null;

update public.products
set status=case when is_active and not is_archived then 'published' else 'unpublished' end,
    published_at=case when is_active and not is_archived then coalesce(published_at,created_at) else published_at end
where seller_id is not null and status='approved';

create index if not exists products_seller_review_queue_idx
  on public.products(status,submitted_at) where seller_id is not null and deleted_at is null;
create index if not exists products_revision_of_idx on public.products(revision_of) where revision_of is not null;

create table if not exists public.seller_notifications (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  event_type text not null check (event_type in ('approved','rejected','unpublished','republished')),
  title text not null,
  message text not null,
  target_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.seller_notifications enable row level security;
drop policy if exists seller_notifications_read_own on public.seller_notifications;
create policy seller_notifications_read_own on public.seller_notifications
for select to authenticated
using (seller_id=(select auth.uid()) and public.current_user_is_seller());
drop policy if exists seller_notifications_update_own on public.seller_notifications;
create policy seller_notifications_update_own on public.seller_notifications
for update to authenticated
using (seller_id=(select auth.uid()) and public.current_user_is_seller())
with check (seller_id=(select auth.uid()) and public.current_user_is_seller());
revoke all on public.seller_notifications from anon,authenticated;
grant select on public.seller_notifications to authenticated;
grant update(read_at) on public.seller_notifications to authenticated;
grant insert,update,delete on public.seller_notifications to service_role;
create index if not exists seller_notifications_unread_idx
  on public.seller_notifications(seller_id,created_at desc) where read_at is null;

create or replace function public.seller_create_product(
  p_title text,p_slug text,p_description text,p_exam_label text,p_subject_label text,
  p_price numeric,p_pdf_path text,p_preview_path text default null
)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_product_id uuid;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_title,''))) not between 5 and 120
    or length(btrim(coalesce(p_description,''))) not between 20 and 2000
    or length(btrim(coalesce(p_subject_label,''))) not between 2 and 60
    or p_exam_label not in ('NEET','JEE','UPSC','SSC','CGL','CLAT','CA','Other')
    or p_price<10 or p_price>5000 or round(p_price,2)<>p_price then
    raise exception 'invalid product details' using errcode='22023';
  end if;
  if p_pdf_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')
    or (p_preview_path is not null and p_preview_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')) then
    raise exception 'invalid product file path' using errcode='22023';
  end if;

  insert into public.products(
    title,slug,description,course_label,subject_label,price,pdf_file,preview_file,
    product_type,format,is_free,is_active,is_archived,is_demo,is_featured,
    created_by,seller_id,status,submitted_at
  ) values (
    btrim(p_title),p_slug,btrim(p_description),p_exam_label,btrim(p_subject_label),p_price,
    p_pdf_path,p_preview_path,'pdf','PDF',false,false,false,false,false,
    v_user,v_user,'pending',now()
  ) returning id into v_product_id;
  return v_product_id;
end;
$function$;
revoke all on function public.seller_create_product(text,text,text,text,text,numeric,text,text) from public,anon;
grant execute on function public.seller_create_product(text,text,text,text,text,numeric,text,text) to authenticated;

create or replace function public.seller_update_product(
  p_product_id uuid,p_title text,p_slug text,p_description text,p_exam_label text,
  p_subject_label text,p_price numeric,p_pdf_path text,p_preview_path text default null
)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_product public.products%rowtype;
  v_has_orders boolean:=false;
  v_new_id uuid;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode='42501';
  end if;
  select * into v_product from public.products
  where id=p_product_id and seller_id=v_user and deleted_at is null for update;
  if not found then raise exception 'product not found' using errcode='P0002'; end if;
  if v_product.is_archived then raise exception 'archived products are read only' using errcode='42501'; end if;
  if v_product.status not in ('pending','rejected','published') then
    raise exception 'product status cannot be edited' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_title,''))) not between 5 and 120
    or length(btrim(coalesce(p_description,''))) not between 20 and 2000
    or length(btrim(coalesce(p_subject_label,''))) not between 2 and 60
    or p_exam_label not in ('NEET','JEE','UPSC','SSC','CGL','CLAT','CA','Other')
    or p_price<10 or p_price>5000 or round(p_price,2)<>p_price then
    raise exception 'invalid product details' using errcode='22023';
  end if;
  if p_pdf_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')
    or (p_preview_path is not null and p_preview_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')) then
    raise exception 'invalid product file path' using errcode='22023';
  end if;

  select exists(select 1 from public.orders o where o.product_id=p_product_id) into v_has_orders;
  if v_product.status='published' then
    perform set_config('app.seller_product_write','enabled',true);
    insert into public.products(
      title,slug,description,whats_included,category_id,course_label,subject_label,keywords,price,
      discounted_price,cover_image,pdf_file,preview_file,page_count,format,is_free,is_featured,is_active,
      is_demo,stock_quantity,stock_status,low_stock_threshold,is_archived,created_by,seller_id,status,
      submitted_at,revision_of
    ) values(
      btrim(p_title),p_slug,btrim(p_description),v_product.whats_included,v_product.category_id,
      p_exam_label,btrim(p_subject_label),v_product.keywords,p_price,v_product.discounted_price,
      v_product.cover_image,p_pdf_path,p_preview_path,v_product.page_count,v_product.format,v_product.is_free,
      v_product.is_featured,false,v_product.is_demo,v_product.stock_quantity,v_product.stock_status,
      v_product.low_stock_threshold,false,v_user,v_user,'pending',now(),p_product_id
    ) returning id into v_new_id;
    return true;
  end if;

  perform set_config('app.seller_product_write','enabled',true);
  if v_product.status='rejected' then
    perform set_config('app.marketplace_transition','enabled',true);
  end if;
  update public.products set
    title=btrim(p_title),slug=p_slug,description=btrim(p_description),
    course_label=p_exam_label,subject_label=btrim(p_subject_label),price=p_price,
    pdf_file=p_pdf_path,preview_file=p_preview_path,
    status=case when v_product.status='rejected' then 'pending' else status end,
    review_feedback=case when v_product.status='rejected' then null else review_feedback end,
    rejection_reason=case when v_product.status='rejected' then null else rejection_reason end,
    submitted_at=case when v_product.status='rejected' then now() else submitted_at end,
    reviewed_at=case when v_product.status='rejected' then null else reviewed_at end,
    reviewed_by=case when v_product.status='rejected' then null else reviewed_by end,
    updated_at=now()
  where id=p_product_id and seller_id=v_user;
  return v_has_orders;
end;
$function$;
revoke all on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text) from public,anon;
grant execute on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text) to authenticated;

create or replace function public.transition_seller_product(
  p_product_id uuid,p_action text,p_reason text default null,p_admin_notes text default null
)
returns public.products language plpgsql security definer set search_path=''
as $function$
declare
  v_admin uuid:=auth.uid();
  v_product public.products%rowtype;
  v_updated public.products%rowtype;
  v_new_status text;
  v_event text;
  v_title text;
  v_message text;
  v_target text;
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
    perform set_config('app.marketplace_transition','enabled',true);
    update public.products set admin_notes=nullif(left(btrim(coalesce(p_admin_notes,'')),4000),''),
      updated_at=now() where id=p_product_id and seller_id is not null and deleted_at is null returning * into v_updated;
    insert into public.admin_activity_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
    values(v_admin,'seller_product_notes','product',p_product_id,
      jsonb_build_object('admin_notes',v_product.admin_notes),
      jsonb_build_object('admin_notes',v_updated.admin_notes));
    return v_updated;
  end if;

  v_new_status:=case p_action when 'approve' then 'published' when 'reject' then 'rejected'
    when 'unpublish' then 'unpublished' when 'republish' then 'published' end;
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
    update public.products set
      title=v_product.title,slug=v_product.slug,description=v_product.description,
      whats_included=v_product.whats_included,category_id=v_product.category_id,
      course_label=v_product.course_label,subject_label=v_product.subject_label,keywords=v_product.keywords,
      price=v_product.price,discounted_price=v_product.discounted_price,cover_image=v_product.cover_image,
      pdf_file=v_product.pdf_file,preview_file=v_product.preview_file,page_count=v_product.page_count,
      format=v_product.format,is_free=v_product.is_free,product_type=v_product.product_type,
      stock_quantity=v_product.stock_quantity,stock_status=v_product.stock_status,
      updated_at=now()
    where id=v_product.revision_of and seller_id=v_product.seller_id
      and status='published' and deleted_at is null;
    if not found then raise exception 'live product revision target is not published' using errcode='22023'; end if;
  end if;

  perform set_config('app.marketplace_transition','enabled',true);
  update public.products set
    status=v_new_status,
    is_active=(v_new_status='published' and revision_of is null),
    is_archived=false,
    reviewed_at=now(),
    reviewed_by=v_admin,
    published_at=case when v_new_status='published' then coalesce(published_at,now()) else published_at end,
    rejection_reason=case when v_new_status='rejected' then left(btrim(p_reason),1000) else null end,
    review_feedback=case when v_new_status='rejected' then left(btrim(p_reason),1000) else null end,
    deleted_at=case when p_action='approve' and revision_of is not null then now() else deleted_at end,
    updated_at=now()
  where id=p_product_id returning * into v_updated;

  insert into public.admin_activity_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(v_admin,'seller_product_'||p_action,'product',p_product_id,
    jsonb_build_object('status',v_product.status),
    jsonb_build_object('status',v_updated.status,'reason',v_updated.rejection_reason,'revision_of',v_updated.revision_of));

  v_event:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected'
    when 'unpublish' then 'unpublished' else 'republished' end;
  v_title:=case v_event when 'approved' then 'Your product is live'
    when 'rejected' then 'Product needs changes'
    when 'unpublished' then 'Product taken down by admin'
    else 'Your product is live again' end;
  v_message:=case v_event
    when 'approved' then 'Your product "'||v_product.title||'" has been approved and is now live.'
    when 'rejected' then 'Your product "'||v_product.title||'" was not approved. Reason: '||left(btrim(p_reason),1000)
    when 'unpublished' then 'Your product "'||v_product.title||'" was taken down by an administrator.'
    else 'Your product "'||v_product.title||'" has been republished.'
  end;
  v_target:=case when v_event in ('approved','republished') and v_product.revision_of is null
    then '/shop/'||v_product.slug else '/seller/products' end;
  insert into public.seller_notifications(seller_id,product_id,event_type,title,message,target_url)
  values(v_product.seller_id,p_product_id,v_event,v_title,v_message,v_target);
  return v_updated;
end;
$function$;
revoke all on function public.transition_seller_product(uuid,text,text,text) from public,anon;
grant execute on function public.transition_seller_product(uuid,text,text,text) to authenticated;

create or replace function public.admin_review_seller_product(
  p_product_id uuid,p_status text,p_review_feedback text default null
)
returns void language plpgsql security definer set search_path=''
as $function$
begin
  if p_status='approved' then
    perform public.transition_seller_product(p_product_id,'approve',null,null);
  elsif p_status='rejected' then
    perform public.transition_seller_product(p_product_id,'reject',p_review_feedback,null);
  else
    raise exception 'status must be approved or rejected' using errcode='22023';
  end if;
end;
$function$;
revoke all on function public.admin_review_seller_product(uuid,text,text) from public,anon;
grant execute on function public.admin_review_seller_product(uuid,text,text) to authenticated;

create or replace function public.guard_marketplace_product_fields()
returns trigger language plpgsql security invoker set search_path=''
as $function$
begin
  if tg_op='UPDATE' and old.seller_id is not null
     and new.status is distinct from old.status
     and current_setting('app.marketplace_transition',true) is distinct from 'enabled' then
    raise exception 'Product status must be changed through the marketplace transition function' using errcode='42501';
  end if;
  if tg_op='UPDATE' and current_setting('app.seller_product_write',true)='enabled'
     and old.seller_id=auth.uid() and public.current_user_is_seller()
     and new.status is not distinct from old.status then
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
$function$;
drop trigger if exists guard_marketplace_product_fields on public.products;
create trigger guard_marketplace_product_fields
before insert or update of seller_id,status,admin_notes on public.products
for each row execute function public.guard_marketplace_product_fields();

drop policy if exists marketplace_public_read_approved_products on public.products;
create policy marketplace_public_read_approved_products on public.products
for select to anon,authenticated
using (
  (seller_id is null and status='approved' and is_active=true and not is_archived and deleted_at is null)
  or (seller_id is not null and status='published' and revision_of is null and is_active=true and not is_archived and deleted_at is null)
  or public.is_admin_staff()
  or seller_id=(select auth.uid())
);

commit;
