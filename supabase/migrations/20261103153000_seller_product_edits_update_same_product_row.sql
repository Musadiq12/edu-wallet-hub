-- Seller edits update the existing product row. Do not create child revision products.
create or replace function public.seller_update_product(
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
  p_rights_confirmed boolean default false,
  p_discounted_price numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_product public.products%rowtype;
  v_has_orders boolean := false;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode = '42501';
  end if;

  select * into v_product from public.products
  where id=p_product_id and seller_id=v_user and deleted_at is null for update;
  if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
  if v_product.is_archived then raise exception 'archived products are read only' using errcode = '42501'; end if;
  if v_product.status not in ('pending','rejected','published','approved') then
    raise exception 'product status cannot be edited' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_title,''))) not between 5 and 120
    or length(btrim(coalesce(p_description,''))) not between 20 and 2000
    or length(btrim(coalesce(p_whats_included,''))) not between 5 and 2000
    or length(btrim(coalesce(p_subject_label,''))) not between 2 and 60
    or p_exam_label not in ('NEET','JEE','UPSC','SSC','CGL','CLAT','CA','Other')
    or p_price is null or p_price < 10 or p_price > 5000 or round(p_price,2) <> p_price
    or (p_discounted_price is not null and (p_discounted_price < 1 or p_discounted_price >= p_price
      or p_discounted_price > 5000 or round(p_discounted_price,2) <> p_discounted_price))
    or p_page_count is null or p_page_count < 1 or p_page_count > 99999
    or p_rights_confirmed is distinct from true then
    raise exception 'invalid product details or rights declaration' using errcode = '22023';
  end if;

  if p_category_id is not null and not exists(select 1 from public.categories c where c.id=p_category_id) then
    raise exception 'invalid product category' using errcode = '22023';
  end if;

  if p_seller_cover_source_url is not null and (
    length(p_seller_cover_source_url)>2048
    or p_seller_cover_source_url !~* '^https://drive[.]google[.]com/(file/d/[A-Za-z0-9_-]{10,}(/view)?([?][^[:space:]]*)?|open[?]id=[A-Za-z0-9_-]{10,}([&][^[:space:]]*)?)$'
  ) then raise exception 'invalid Google Drive cover link' using errcode = '22023'; end if;

  if p_pdf_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')
    or (p_preview_path is not null and p_preview_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')) then
    raise exception 'invalid product file path' using errcode = '22023';
  end if;

  select exists(select 1 from public.orders where product_id=p_product_id) into v_has_orders;

  perform set_config('app.seller_product_write','enabled',true);
  perform set_config('app.marketplace_transition','enabled',true);

  update public.products set
    title=btrim(p_title),slug=p_slug,description=btrim(p_description),
    whats_included=btrim(p_whats_included),category_id=p_category_id,
    course_label=p_exam_label,subject_label=btrim(p_subject_label),
    price=p_price,discounted_price=p_discounted_price,
    pdf_file=p_pdf_path,preview_file=p_preview_path,page_count=p_page_count,
    seller_cover_source_url=p_seller_cover_source_url,seller_rights_confirmed_at=now(),
    status='pending',is_active=false,
    review_feedback=null,rejection_reason=null,reviewed_at=null,reviewed_by=null,
    submitted_at=now(),updated_at=now()
  where id=p_product_id and seller_id=v_user;

  return v_has_orders;
end;
$function$;

revoke all on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean,numeric) from public,anon;
grant execute on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean,numeric) to authenticated;
