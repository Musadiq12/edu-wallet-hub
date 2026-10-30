begin;

alter table public.products
  add column if not exists seller_cover_source_url text,
  add column if not exists seller_rights_confirmed_at timestamptz;

alter table public.products
  drop constraint if exists products_seller_cover_source_url_check;
alter table public.products
  add constraint products_seller_cover_source_url_check
  check (
    seller_cover_source_url is null
    or (
      length(seller_cover_source_url) <= 2048
      and seller_cover_source_url ~* '^https://drive[.]google[.]com/(file/d/[A-Za-z0-9_-]{10,}(/view)?([?][^[:space:]]*)?|open[?]id=[A-Za-z0-9_-]{10,}([&][^[:space:]]*)?)$'
    )
  );

drop function if exists public.seller_create_product(text,text,text,text,text,numeric,text,text);
create function public.seller_create_product(
  p_title text,
  p_slug text,
  p_description text,
  p_exam_label text,
  p_subject_label text,
  p_price numeric,
  p_pdf_path text,
  p_preview_path text default null,
  p_whats_included text default null,
  p_category_id uuid default null,
  p_page_count integer default null,
  p_seller_cover_source_url text default null,
  p_rights_confirmed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
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
     or length(btrim(coalesce(p_whats_included,''))) not between 5 and 2000
     or length(btrim(coalesce(p_subject_label,''))) not between 2 and 60
     or p_exam_label not in ('NEET','JEE','UPSC','SSC','CGL','CLAT','CA','Other')
     or p_price is null or p_price < 10 or p_price > 5000 or round(p_price,2) <> p_price
     or p_page_count is null or p_page_count < 1 or p_page_count > 99999
     or p_rights_confirmed is distinct from true then
    raise exception 'invalid product details or rights declaration' using errcode='22023';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories c where c.id=p_category_id
  ) then
    raise exception 'invalid product category' using errcode='22023';
  end if;

  if p_seller_cover_source_url is not null and (
    length(p_seller_cover_source_url)>2048
    or p_seller_cover_source_url !~* '^https://drive[.]google[.]com/(file/d/[A-Za-z0-9_-]{10,}(/view)?([?][^[:space:]]*)?|open[?]id=[A-Za-z0-9_-]{10,}([&][^[:space:]]*)?)$'
  ) then
    raise exception 'invalid Google Drive cover link' using errcode='22023';
  end if;

  if p_pdf_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')
     or (p_preview_path is not null and p_preview_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')) then
    raise exception 'invalid product file path' using errcode='22023';
  end if;

  insert into public.products(
    title,slug,description,whats_included,category_id,course_label,subject_label,
    price,pdf_file,preview_file,page_count,seller_cover_source_url,seller_rights_confirmed_at,
    product_type,format,is_free,is_active,is_archived,is_demo,is_featured,created_by,seller_id,status,submitted_at
  ) values (
    btrim(p_title),p_slug,btrim(p_description),btrim(p_whats_included),p_category_id,
    p_exam_label,btrim(p_subject_label),p_price,p_pdf_path,p_preview_path,p_page_count,
    p_seller_cover_source_url,now(),'pdf','PDF',false,false,false,false,false,
    v_user,v_user,'pending',now()
  )
  returning id into v_product_id;

  return v_product_id;
end;
$$;

drop function if exists public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text);
create function public.seller_update_product(
  p_product_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_exam_label text,
  p_subject_label text,
  p_price numeric,
  p_pdf_path text,
  p_preview_path text default null,
  p_whats_included text default null,
  p_category_id uuid default null,
  p_page_count integer default null,
  p_seller_cover_source_url text default null,
  p_rights_confirmed boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_has_orders boolean := false;
  v_new_id uuid;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode='42501';
  end if;

  select * into v_product from public.products
  where id=p_product_id and seller_id=v_user and deleted_at is null
  for update;
  if not found then raise exception 'product not found' using errcode='P0002'; end if;
  if v_product.is_archived then raise exception 'archived products are read only' using errcode='42501'; end if;
  if v_product.status not in ('pending','rejected','published','approved') then
    raise exception 'product status cannot be edited' using errcode='42501';
  end if;

  if length(btrim(coalesce(p_title,''))) not between 5 and 120
     or length(btrim(coalesce(p_description,''))) not between 20 and 2000
     or length(btrim(coalesce(p_whats_included,''))) not between 5 and 2000
     or length(btrim(coalesce(p_subject_label,''))) not between 2 and 60
     or p_exam_label not in ('NEET','JEE','UPSC','SSC','CGL','CLAT','CA','Other')
     or p_price is null or p_price < 10 or p_price > 5000 or round(p_price,2) <> p_price
     or p_page_count is null or p_page_count < 1 or p_page_count > 99999
     or p_rights_confirmed is distinct from true then
    raise exception 'invalid product details or rights declaration' using errcode='22023';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories c where c.id=p_category_id
  ) then
    raise exception 'invalid product category' using errcode='22023';
  end if;

  if p_seller_cover_source_url is not null and (
    length(p_seller_cover_source_url)>2048
    or p_seller_cover_source_url !~* '^https://drive[.]google[.]com/(file/d/[A-Za-z0-9_-]{10,}(/view)?([?][^[:space:]]*)?|open[?]id=[A-Za-z0-9_-]{10,}([&][^[:space:]]*)?)$'
  ) then
    raise exception 'invalid Google Drive cover link' using errcode='22023';
  end if;

  if p_pdf_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')
     or (p_preview_path is not null and p_preview_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')) then
    raise exception 'invalid product file path' using errcode='22023';
  end if;

  select exists(select 1 from public.orders where product_id=p_product_id) into v_has_orders;

  if v_product.status in ('published','approved') then
    perform set_config('app.seller_product_write','enabled',true);
    insert into public.products(
      title,slug,description,whats_included,category_id,course_label,subject_label,keywords,
      price,discounted_price,cover_image,pdf_file,preview_file,page_count,seller_cover_source_url,
      seller_rights_confirmed_at,format,is_free,is_featured,is_active,is_demo,stock_quantity,
      stock_status,low_stock_threshold,is_archived,created_by,seller_id,status,submitted_at,revision_of
    ) values (
      btrim(p_title),p_slug,btrim(p_description),btrim(p_whats_included),p_category_id,
      p_exam_label,btrim(p_subject_label),v_product.keywords,p_price,v_product.discounted_price,
      v_product.cover_image,p_pdf_path,p_preview_path,p_page_count,p_seller_cover_source_url,now(),
      v_product.format,v_product.is_free,v_product.is_featured,false,v_product.is_demo,
      v_product.stock_quantity,v_product.stock_status,v_product.low_stock_threshold,false,
      v_user,v_user,'pending',now(),p_product_id
    ) returning id into v_new_id;
    return true;
  end if;

  perform set_config('app.seller_product_write','enabled',true);
  if v_product.status='rejected' then perform set_config('app.marketplace_transition','enabled',true); end if;

  update public.products set
    title=btrim(p_title),slug=p_slug,description=btrim(p_description),
    whats_included=btrim(p_whats_included),category_id=p_category_id,
    course_label=p_exam_label,subject_label=btrim(p_subject_label),price=p_price,
    pdf_file=p_pdf_path,preview_file=p_preview_path,page_count=p_page_count,
    seller_cover_source_url=p_seller_cover_source_url,seller_rights_confirmed_at=now(),
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
$$;

revoke all on function public.seller_create_product(text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean) from public,anon;
grant execute on function public.seller_create_product(text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean) to authenticated;
revoke all on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean) from public,anon;
grant execute on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean) to authenticated;

commit;
