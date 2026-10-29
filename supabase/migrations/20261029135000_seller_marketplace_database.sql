-- Seller marketplace database foundation for EduWallet.
-- Additive by design: preserve buyer checkout, existing admin authorization, catalog/payment columns,
-- and current product-files storage objects.

begin;

-- 1. Marketplace role on profiles. Existing authorization remains backed by user_roles/admin_users.
alter table public.profiles
  add column if not exists role text not null default 'buyer';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_marketplace_role_check'
  ) then
    alter table public.profiles add constraint profiles_marketplace_role_check
      check (role in ('buyer','seller','admin')) not valid;
  end if;
end $$;
alter table public.profiles validate constraint profiles_marketplace_role_check;

create or replace function public.guard_marketplace_profile_role()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role
     and auth.uid() is not null and auth.uid() = old.id
     and not public.is_admin_staff() then
    raise exception 'Only an administrator can change marketplace roles' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.role <> 'buyer'
     and auth.uid() is not null and not public.is_admin_staff() then
    raise exception 'New profiles must use the buyer role' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_marketplace_profile_role on public.profiles;
create trigger guard_marketplace_profile_role
before insert or update of role on public.profiles
for each row execute function public.guard_marketplace_profile_role();
comment on column public.profiles.role is
  'Marketplace-facing role label; current admin authorization remains backed by user_roles/admin_users.';

-- 2. Seller onboarding/KYC. Applicants can insert once and read their row; only admin RPC can review.
create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  profession text not null,
  education text not null,
  qualification_proof_path text,
  id_card_path text,
  pan_number text not null,
  upi_id text not null,
  bank_details jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
comment on table public.seller_applications is
  'Private seller onboarding and KYC data; readable by the applicant and authorized admins.';
alter table public.seller_applications enable row level security;
drop policy if exists seller_applications_read_own_or_admin on public.seller_applications;
create policy seller_applications_read_own_or_admin on public.seller_applications
for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin_staff());
drop policy if exists seller_applications_insert_own_pending on public.seller_applications;
create policy seller_applications_insert_own_pending on public.seller_applications
for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending'
  and reviewed_at is null and rejection_reason is null);
-- Table writes are narrowed to SELECT/INSERT; users cannot edit or delete a submitted application.
revoke all on public.seller_applications from anon, authenticated;
grant select, insert on public.seller_applications to authenticated;

-- 3. Marketplace moderation fields. Existing catalog rows stay approved.
alter table public.products
  add column if not exists seller_id uuid references auth.users(id) on delete set null,
  add column if not exists status text not null default 'pending';
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.products'::regclass
                 and conname='products_marketplace_status_check') then
    alter table public.products add constraint products_marketplace_status_check
      check (status in ('pending','approved','rejected')) not valid;
  end if;
end $$;
update public.products set status='approved' where seller_id is null and status='pending';
alter table public.products validate constraint products_marketplace_status_check;
comment on table public.products is
  'Study-resource catalog with additive marketplace ownership and moderation fields; existing admin policies retained.';
comment on column public.products.seller_id is 'Marketplace owner; NULL for legacy/admin-managed products.';
comment on column public.products.status is 'Marketplace status; legacy catalog rows approved, new rows pending.';
create index if not exists products_seller_id_idx on public.products(seller_id);
create index if not exists products_marketplace_status_idx on public.products(status);

-- Existing catalog read policies are deliberately replaced because PostgreSQL ORs permissive
-- policies together. Keeping the old active-only policy would bypass the new approval status.
drop policy if exists "public read active products" on public.products;
drop policy if exists "authenticated read active products" on public.products;
drop policy if exists marketplace_public_read_approved_products on public.products;
create policy marketplace_public_read_approved_products on public.products
for select to anon, authenticated
using (
  status='approved' and is_active=true and not is_archived
  or public.is_admin_staff()
  or (seller_id=(select auth.uid()))
);
drop policy if exists seller_insert_own_pending_products on public.products;
create policy seller_insert_own_pending_products on public.products
for insert to authenticated
with check (seller_id=(select auth.uid()) and created_by=(select auth.uid()) and status='pending'
  and exists (select 1 from public.seller_applications a
              where a.user_id=(select auth.uid()) and a.status='approved'));
drop policy if exists seller_update_own_pending_products on public.products;
create policy seller_update_own_pending_products on public.products
for update to authenticated
using (seller_id=(select auth.uid()) and status in ('pending','rejected'))
with check (seller_id=(select auth.uid()) and status in ('pending','rejected')
  and created_by=(select auth.uid()));

create or replace function public.guard_marketplace_product_fields()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
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
drop trigger if exists guard_marketplace_product_fields on public.products;
create trigger guard_marketplace_product_fields
before insert or update of seller_id,status on public.products
for each row execute function public.guard_marketplace_product_fields();

-- 4. Payout fields on existing orders; no buyer checkout field is renamed or removed.
alter table public.orders
  add column if not exists seller_id uuid references auth.users(id) on delete set null,
  add column if not exists seller_share numeric(12,2),
  add column if not exists platform_share numeric(12,2),
  add column if not exists available_on timestamptz,
  add column if not exists refunded boolean not null default false;
-- Backfill verified orders only when the related product has an owner.
update public.orders o
set seller_id=p.seller_id,
    seller_share=round(o.amount*0.90,2),
    platform_share=o.amount-round(o.amount*0.90,2),
    available_on=coalesce(o.verified_at,o.created_at)+interval '7 days'
from public.products p
where o.product_id=p.id and p.seller_id is not null
  and lower(o.payment_status::text)='verified' and o.seller_id is null;
comment on table public.orders is
  'Existing buyer/payment records extended with seller payout accounting; original payment workflow preserved.';
comment on column public.orders.seller_id is 'Seller attributed to this marketplace order.';
comment on column public.orders.seller_share is 'Seller share: 90% of verified order amount, rounded to two decimal places.';
comment on column public.orders.platform_share is 'Platform share: remaining 10% of verified order amount.';
comment on column public.orders.available_on is 'Seller share release timestamp, seven days after payment verification.';
comment on column public.orders.refunded is 'Refund marker; true excludes seller_share from balance calculations.';
create index if not exists orders_marketplace_seller_available_idx
on public.orders(seller_id,available_on) where seller_id is not null;

-- 5. Seller withdrawals. Requested/paid withdrawals reserve or consume available balance.
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount>0),
  status text not null default 'requested' check (status in ('requested','paid','rejected')),
  upi_reference text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);
comment on table public.withdrawal_requests is
  'Seller payout requests; owner/admin read access, admin-only settlement through a controlled RPC.';
alter table public.withdrawal_requests enable row level security;
drop policy if exists withdrawal_requests_read_own_or_admin on public.withdrawal_requests;
create policy withdrawal_requests_read_own_or_admin on public.withdrawal_requests
for select to authenticated
using (seller_id=(select auth.uid()) or public.is_admin_staff());
drop policy if exists withdrawal_requests_insert_own_requested on public.withdrawal_requests;
create policy withdrawal_requests_insert_own_requested on public.withdrawal_requests
for insert to authenticated
with check (seller_id=(select auth.uid()) and status='requested' and paid_at is null);
revoke all on public.withdrawal_requests from anon,authenticated;
grant select,insert on public.withdrawal_requests to authenticated;

-- 6. Seller balance is caller-scoped; no seller can query another seller's balance.
create or replace function public.seller_balance(p_seller_id uuid)
returns table(pending_balance numeric,available_balance numeric)
language sql stable security invoker set search_path = ''
as $$
  select
    coalesce(sum(o.seller_share) filter (where o.available_on>now() and not o.refunded),0)::numeric(12,2),
    (coalesce(sum(o.seller_share) filter (where o.available_on<=now() and not o.refunded),0)
     - coalesce((select sum(w.amount) from public.withdrawal_requests w
                 where w.seller_id=p_seller_id and w.status in ('requested','paid')),0)
    )::numeric(12,2)
  from public.orders o
  where o.seller_id=p_seller_id and p_seller_id=(select auth.uid()) and o.seller_share is not null;
$$;
revoke all on function public.seller_balance(uuid) from public,anon;
grant execute on function public.seller_balance(uuid) to authenticated;

-- Admin-only review RPC. Existing administrator tables/functions remain the authorization source.
create or replace function public.admin_review_seller_application(
  p_application_id uuid,p_status text,p_rejection_reason text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid;
begin
  if auth.uid() is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode='42501';
  end if;
  if p_status not in ('approved','rejected') then
    raise exception 'status must be approved or rejected' using errcode='22023';
  end if;
  update public.seller_applications
  set status=p_status,
      rejection_reason=case when p_status='rejected' then nullif(trim(p_rejection_reason),'') else null end,
      reviewed_at=now()
  where id=p_application_id returning user_id into v_user_id;
  if not found then raise exception 'seller application not found' using errcode='P0002'; end if;
  update public.profiles set role=case when p_status='approved' then 'seller' else 'buyer' end
  where id=v_user_id;
end;
$$;
revoke all on function public.admin_review_seller_application(uuid,text,text) from public,anon;
grant execute on function public.admin_review_seller_application(uuid,text,text) to authenticated;

create or replace function public.admin_set_withdrawal_status(
  p_request_id uuid,p_status text,p_upi_reference text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin_staff() then
    raise exception 'administrator access required' using errcode='42501';
  end if;
  if p_status not in ('paid','rejected') then
    raise exception 'status must be paid or rejected' using errcode='22023';
  end if;
  update public.withdrawal_requests
  set status=p_status,
      upi_reference=case when p_status='paid' then nullif(trim(p_upi_reference),'') else upi_reference end,
      paid_at=case when p_status='paid' then now() else null end
  where id=p_request_id and status='requested';
  if not found then raise exception 'withdrawal not found or already reviewed' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.admin_set_withdrawal_status(uuid,text,text) from public,anon;
grant execute on function public.admin_set_withdrawal_status(uuid,text,text) to authenticated;

-- 7. Both seller storage buckets are private. product-files exists already; preserve its objects/admin policies.
insert into storage.buckets(id,name,public) values('seller-documents','seller-documents',false)
on conflict(id) do update set public=false;
insert into storage.buckets(id,name,public) values('product-files','product-files',false)
on conflict(id) do update set public=false;

-- Object paths in seller-documents start with <seller-uuid>/.
drop policy if exists seller_documents_owner_read on storage.objects;
create policy seller_documents_owner_read on storage.objects for select to authenticated
using(bucket_id='seller-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists seller_documents_owner_insert on storage.objects;
create policy seller_documents_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='seller-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists seller_documents_owner_update on storage.objects;
create policy seller_documents_owner_update on storage.objects for update to authenticated
using(bucket_id='seller-documents' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='seller-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists seller_documents_admin_all on storage.objects;
create policy seller_documents_admin_all on storage.objects for all to authenticated
using(bucket_id='seller-documents' and public.is_admin_staff())
with check(bucket_id='seller-documents' and public.is_admin_staff());

-- product-files paths start <seller-uuid>/<product-uuid>/<file>. No public policy is added.
drop policy if exists seller_product_files_owner_read on storage.objects;
create policy seller_product_files_owner_read on storage.objects for select to authenticated
using(bucket_id='product-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists seller_product_files_owner_insert on storage.objects;
create policy seller_product_files_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='product-files' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.seller_applications a
             where a.user_id=(select auth.uid()) and a.status='approved'));
drop policy if exists seller_product_files_owner_update on storage.objects;
create policy seller_product_files_owner_update on storage.objects for update to authenticated
using(bucket_id='product-files' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='product-files' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
