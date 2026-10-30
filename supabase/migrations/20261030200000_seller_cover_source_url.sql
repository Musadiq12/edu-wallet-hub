begin;
alter table public.products add column if not exists seller_cover_source_url text;
alter table public.products drop constraint if exists products_seller_cover_source_url_check;
alter table public.products add constraint products_seller_cover_source_url_check
  check (seller_cover_source_url is null or (
    length(seller_cover_source_url) <= 1000
    and seller_cover_source_url ~* '^https://(drive\\.google\\.com|docs\\.google\\.com)/'
  )) not valid;
alter table public.products validate constraint products_seller_cover_source_url_check;
commit;
