begin;

drop function if exists public.seller_create_product(text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean);

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
  p_rights_confirmed boolean default false,
  p_discounted_price numeric default null
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
     or (p_discounted_price is not null and (
       p_discounted_price < 1 or p_discounted_price >= p_price
       or p_discounted_price > 5000 or round(p_discounted_price,2) <> p_discounted_price
     ))
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
    price,discounted_price,pdf_file,preview_file,page_count,seller_cover_source_url,
    seller_rights_confirmed_at,product_type,format,is_free,is_active,is_archived,
    is_demo,is_featured,created_by,seller_id,status,submitted_at
  ) values (
    btrim(p_title),p_slug,btrim(p_description),btrim(p_whats_included),p_category_id,
    p_exam_label,btrim(p_subject_label),p_price,p_discounted_price,p_pdf_path,p_preview_path,
    p_page_count,p_seller_cover_source_url,now(),'pdf','PDF',false,false,false,false,false,
    v_user,v_user,'pending',now()
  )
  returning id into v_product_id;

  return v_product_id;
end;
$$;

revoke all on function public.seller_create_product(text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean,numeric) from public,anon;
grant execute on function public.seller_create_product(text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean,numeric) to authenticated;

commit;
