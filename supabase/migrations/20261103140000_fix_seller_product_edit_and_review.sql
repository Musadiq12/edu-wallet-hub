begin;

-- Carry seller pricing and descriptive edits into the pending copy of a live listing.
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
  v_new_id uuid;
begin
  if v_user is null or not public.current_user_is_seller() then
    raise exception 'seller access required' using errcode = '42501';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and seller_id = v_user and deleted_at is null
  for update;
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
    or (p_discounted_price is not null and (
      p_discounted_price < 1 or p_discounted_price >= p_price
      or p_discounted_price > 5000 or round(p_discounted_price,2) <> p_discounted_price
    ))
    or p_page_count is null or p_page_count < 1 or p_page_count > 99999
    or p_rights_confirmed is distinct from true then
    raise exception 'invalid product details or rights declaration' using errcode = '22023';
  end if;

  if p_category_id is not null and not exists(select 1 from public.categories c where c.id = p_category_id) then
    raise exception 'invalid product category' using errcode = '22023';
  end if;

  if p_seller_cover_source_url is not null and (
    length(p_seller_cover_source_url) > 2048
    or p_seller_cover_source_url !~* '^https://drive[.]google[.]com/(file/d/[A-Za-z0-9_-]{10,}(/view)?([?][^[:space:]]*)?|open[?]id=[A-Za-z0-9_-]{10,}([&][^[:space:]]*)?)$'
  ) then
    raise exception 'invalid Google Drive cover link' using errcode = '22023';
  end if;

  if p_pdf_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')
    or (p_preview_path is not null and p_preview_path !~ ('^'||v_user::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}_[A-Za-z0-9_-]+[.]pdf$')) then
    raise exception 'invalid product file path' using errcode = '22023';
  end if;

  select exists(select 1 from public.orders where product_id = p_product_id) into v_has_orders;

  if v_product.status in ('published','approved') then
    -- Keep one reviewable pending row for each live product; update it on subsequent edits.
    perform set_config('app.seller_product_write','enabled',true);
    select id into v_new_id
    from public.products
    where seller_id = v_user and revision_of = p_product_id
      and status = 'pending' and deleted_at is null
    order by created_at desc
    limit 1
    for update;

    if v_new_id is null then
      insert into public.products(
        title,slug,description,whats_included,category_id,course_label,subject_label,keywords,
        price,discounted_price,cover_image,pdf_file,preview_file,page_count,seller_cover_source_url,
        seller_rights_confirmed_at,format,is_free,is_featured,is_active,is_demo,product_type,
        stock_quantity,stock_status,low_stock_threshold,is_archived,created_by,seller_id,status,
        submitted_at,revision_of,product_images
      ) values (
        btrim(p_title),p_slug,btrim(p_description),btrim(p_whats_included),p_category_id,
        p_exam_label,btrim(p_subject_label),v_product.keywords,p_price,p_discounted_price,
        v_product.cover_image,p_pdf_path,p_preview_path,p_page_count,p_seller_cover_source_url,now(),
        v_product.format,v_product.is_free,v_product.is_featured,false,v_product.is_demo,v_product.product_type,
        v_product.stock_quantity,v_product.stock_status,v_product.low_stock_threshold,false,
        v_user,v_user,'pending',now(),p_product_id,v_product.product_images
      ) returning id into v_new_id;
    else
      update public.products set
        title=btrim(p_title),slug=p_slug,description=btrim(p_description),
        whats_included=btrim(p_whats_included),category_id=p_category_id,
        course_label=p_exam_label,subject_label=btrim(p_subject_label),
        price=p_price,discounted_price=p_discounted_price,
        pdf_file=p_pdf_path,preview_file=p_preview_path,page_count=p_page_count,
        seller_cover_source_url=p_seller_cover_source_url,seller_rights_confirmed_at=now(),
        submitted_at=now(),updated_at=now()
      where id=v_new_id and seller_id=v_user;
    end if;
    return true;
  end if;

  perform set_config('app.seller_product_write','enabled',true);
  if v_product.status = 'rejected' then perform set_config('app.marketplace_transition','enabled',true); end if;

  update public.products set
    title=btrim(p_title),slug=p_slug,description=btrim(p_description),
    whats_included=btrim(p_whats_included),category_id=p_category_id,
    course_label=p_exam_label,subject_label=btrim(p_subject_label),
    price=p_price,discounted_price=p_discounted_price,
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
$function$;

revoke all on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean,numeric) from public,anon;
grant execute on function public.seller_update_product(uuid,text,text,text,text,text,numeric,text,text,text,uuid,integer,text,boolean,numeric) to authenticated;

-- Approval updates the canonical listing then removes the pending edit from the review queue.
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
as $function$
declare
  v_admin uuid := auth.uid();
  v_product public.products%rowtype;
  v_updated public.products%rowtype;
  v_status text;
  v_event text;
  v_title text;
  v_message text;
  v_target text;
  v_parent public.products%rowtype;
begin
  if v_admin is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if p_action not in ('approve','reject','unpublish','republish','save_notes') then
    raise exception 'invalid moderation action' using errcode = '22023';
  end if;

  select * into v_product from public.products
  where id=p_product_id and seller_id is not null and deleted_at is null
  for update;
  if not found then raise exception 'seller product not found' using errcode = 'P0002'; end if;

  if p_action='save_notes' then
    perform set_config('app.marketplace_transition','enabled',true);
    update public.products set admin_notes=nullif(left(btrim(coalesce(p_admin_notes,'')),4000),''),
      updated_at=now() where id=p_product_id returning * into v_updated;
    insert into public.admin_activity_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
    values(v_admin,'seller_product_notes','product',p_product_id,
      jsonb_build_object('admin_notes',v_product.admin_notes),jsonb_build_object('admin_notes',v_updated.admin_notes));
    return v_updated;
  end if;

  v_status:=case p_action when 'approve' then 'published' when 'reject' then 'rejected'
    when 'unpublish' then 'unpublished' when 'republish' then 'published' end;

  if (p_action='approve' and v_product.status<>'pending')
    or (p_action='reject' and v_product.status<>'pending')
    or (p_action='unpublish' and v_product.status<>'published')
    or (p_action='republish' and v_product.status<>'unpublished') then
    raise exception 'invalid product status transition' using errcode = '22023';
  end if;
  if p_action='reject' and length(btrim(coalesce(p_reason,'')))<10 then
    raise exception 'Rejection reason must contain at least 10 characters' using errcode = '22023';
  end if;

  if p_action='approve' and v_product.revision_of is not null then
    select * into v_parent from public.products
    where id=v_product.revision_of and seller_id=v_product.seller_id
      and status in ('published','approved') and deleted_at is null
    for update;
    if not found then raise exception 'live product revision target is not published' using errcode = '22023'; end if;

    update public.products set
      title=v_product.title,slug=v_product.slug,description=v_product.description,
      whats_included=v_product.whats_included,category_id=v_product.category_id,
      course_label=v_product.course_label,subject_label=v_product.subject_label,
      keywords=v_product.keywords,price=v_product.price,discounted_price=v_product.discounted_price,
      cover_image=v_product.cover_image,pdf_file=v_product.pdf_file,preview_file=v_product.preview_file,
      page_count=v_product.page_count,format=v_product.format,is_free=v_product.is_free,
      product_type=v_product.product_type,stock_quantity=v_product.stock_quantity,
      stock_status=v_product.stock_status,low_stock_threshold=v_product.low_stock_threshold,
      product_images=v_product.product_images,updated_at=now()
    where id=v_parent.id;
  end if;

  perform set_config('app.marketplace_transition','enabled',true);
  update public.products set
    status=v_status,is_active=(v_status='published' and revision_of is null),is_archived=false,
    reviewed_at=now(),reviewed_by=v_admin,
    published_at=case when v_status='published' then coalesce(published_at,now()) else published_at end,
    rejection_reason=case when p_action='reject' then left(btrim(p_reason),1000) else null end,
    review_feedback=case when p_action='reject' then left(btrim(p_reason),1000) else null end,
    deleted_at=case when p_action='approve' and revision_of is not null then now() else deleted_at end,
    updated_at=now()
  where id=p_product_id returning * into v_updated;

  insert into public.admin_activity_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(v_admin,'seller_product_'||p_action,'product',p_product_id,
    jsonb_build_object('status',v_product.status,'revision_of',v_product.revision_of),
    jsonb_build_object('status',v_updated.status,'reason',v_updated.rejection_reason,'revision_of',v_updated.revision_of));

  v_event:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected'
    when 'unpublish' then 'unpublished' else 'republished' end;
  v_title:=case v_event when 'approved' then 'Your product is live'
    when 'rejected' then 'Product needs changes' when 'unpublished' then 'Product taken down by admin'
    else 'Your product is live again' end;
  v_message:=case v_event
    when 'approved' then 'Your product "'||v_product.title||'" has been approved and its listing is updated.'
    when 'rejected' then 'Your product "'||v_product.title||'" was not approved. Reason: '||left(btrim(p_reason),1000)
    when 'unpublished' then 'Your product "'||v_product.title||'" was taken down by an administrator.'
    else 'Your product "'||v_product.title||'" has been republished.' end;
  v_target:=case when v_event in ('approved','republished') and v_product.revision_of is null
    then '/shop/'||v_product.slug else '/seller/products' end;
  insert into public.seller_notifications(seller_id,product_id,event_type,title,message,target_url)
  values(v_product.seller_id,p_product_id,v_event,v_title,v_message,v_target);

  return v_updated;
end;
$function$;

revoke all on function public.transition_seller_product(uuid,text,text,text) from public,anon;
grant execute on function public.transition_seller_product(uuid,text,text,text) to authenticated;

commit;
