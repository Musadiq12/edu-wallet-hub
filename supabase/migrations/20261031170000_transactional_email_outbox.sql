-- Transactional email outbox for marketplace and buyer lifecycle notifications.
begin;
create table if not exists public.email_outbox (
 id uuid primary key default gen_random_uuid(),
 dedupe_key text not null unique,
 recipient_email text not null,
 recipient_name text,
 event_type text not null,
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0 check(attempts>=0),
 next_attempt_at timestamptz not null default now(),
 last_error text,
 resend_email_id text,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);
create index if not exists email_outbox_dispatch_idx on public.email_outbox(status,next_attempt_at,created_at) where status in ('pending','failed');
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.email_outbox to service_role;

create or replace function public.enqueue_transactional_email(p_dedupe_key text,p_recipient_email text,p_recipient_name text,p_event_type text,p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_recipient_email is null or btrim(p_recipient_email)='' then return; end if;
 insert into public.email_outbox(dedupe_key,recipient_email,recipient_name,event_type,payload)
 values(left(p_dedupe_key,250),lower(btrim(p_recipient_email)),nullif(btrim(p_recipient_name),''),p_event_type,coalesce(p_payload,'{}'::jsonb))
 on conflict(dedupe_key) do nothing;
end; $$;
revoke all on function public.enqueue_transactional_email(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_transactional_email(text,text,text,text,jsonb) to service_role;

create or replace function public.enqueue_seller_application_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_name text;
begin
 if old.status is distinct from new.status and new.status in ('approved','rejected') then
  select coalesce(nullif(p.email,''),u.email),coalesce(nullif(p.full_name,''),new.full_name)
   into v_email,v_name from auth.users u left join public.profiles p on p.id=u.id where u.id=new.user_id;
  perform public.enqueue_transactional_email('seller-application:'||new.id::text||':'||new.status,v_email,v_name,
   case when new.status='approved' then 'seller.account_approved' else 'seller.account_rejected' end,
   jsonb_build_object('reason',new.rejection_reason,'dashboard_url','https://eduwallethub.in/seller/dashboard'));
 end if; return new;
end; $$;
drop trigger if exists enqueue_seller_application_email on public.seller_applications;
create trigger enqueue_seller_application_email after update of status on public.seller_applications for each row execute function public.enqueue_seller_application_email();

create or replace function public.enqueue_seller_product_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_name text; v_event text; v_target text;
begin
 if old.status is distinct from new.status and new.status in ('published','rejected','unpublished') then
  select coalesce(nullif(p.email,''),u.email),coalesce(nullif(p.full_name,''),u.raw_user_meta_data->>'full_name','Seller')
   into v_email,v_name from auth.users u left join public.profiles p on p.id=u.id where u.id=new.seller_id;
  v_event:=case new.status when 'published' then 'seller.product_approved' when 'rejected' then 'seller.product_rejected' else 'seller.product_unpublished' end;
  v_target:=case when new.status='published' then 'https://eduwallethub.in/shop/'||new.slug else 'https://eduwallethub.in/seller/products' end;
  perform public.enqueue_transactional_email('seller-product:'||new.id::text||':'||new.status||':'||coalesce(new.reviewed_at::text,new.updated_at::text),
   v_email,v_name,v_event,jsonb_build_object('product_title',new.title,'reason',coalesce(new.rejection_reason,new.review_feedback),'product_url',v_target,'dashboard_url','https://eduwallethub.in/seller/products'));
 end if; return new;
end; $$;
drop trigger if exists enqueue_seller_product_email on public.products;
create trigger enqueue_seller_product_email after update of status on public.products for each row when(old.seller_id is not null) execute function public.enqueue_seller_product_email();

create or replace function public.enqueue_seller_sale_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_name text; v_sale_count integer;
begin
 if new.seller_id is not null and new.seller_share is not null and new.payment_status='verified' and (tg_op='INSERT' or (old.seller_id is null and new.seller_id is not null and new.verified_at is not null) or (old.seller_id is not distinct from new.seller_id and old.seller_share is null and new.seller_share is not null and new.verified_at is not null)) then
  select coalesce(nullif(p.email,''),u.email),coalesce(nullif(p.full_name,''),u.raw_user_meta_data->>'full_name','Seller')
   into v_email,v_name from auth.users u left join public.profiles p on p.id=u.id where u.id=new.seller_id;
  select count(*) into v_sale_count from public.orders where seller_id=new.seller_id and seller_share is not null and refunded=false and payment_status='verified' and id<>new.id;
  perform public.enqueue_transactional_email('seller-sale:'||new.id::text||':'||new.seller_id::text,v_email,v_name,
   case when v_sale_count=0 then 'seller.first_sale' else 'seller.new_sale' end,
   jsonb_build_object('product_title',new.product_title,'seller_share',new.seller_share,'order_id',new.id,'dashboard_url','https://eduwallethub.in/seller/sales'));
 end if; return new;
end; $$;
drop trigger if exists enqueue_seller_sale_email on public.orders;
create trigger enqueue_seller_sale_email after insert or update of seller_id,seller_share on public.orders for each row execute function public.enqueue_seller_sale_email();

create or replace function public.enqueue_withdrawal_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_name text;
begin
 if old.status is distinct from new.status then
  select coalesce(nullif(p.email,''),u.email),coalesce(nullif(p.full_name,''),u.raw_user_meta_data->>'full_name','Seller')
   into v_email,v_name from auth.users u left join public.profiles p on p.id=u.id where u.id=new.seller_id;
  perform public.enqueue_transactional_email('seller-withdrawal:'||new.id::text||':'||new.status,v_email,v_name,
   case new.status when 'processing' then 'seller.payout_processing' when 'paid' then 'seller.payout_marked_paid' when 'rejected' then 'seller.payout_rejected' else 'seller.payout_requested' end,
   jsonb_build_object('amount',new.amount,'upi_reference',new.upi_reference,'reason',new.rejection_reason,'withdrawal_id',new.id,'wallet_url','https://eduwallethub.in/seller/wallet'));
 end if; return new;
end; $$;
drop trigger if exists enqueue_withdrawal_email on public.withdrawal_requests;
create trigger enqueue_withdrawal_email after update of status on public.withdrawal_requests for each row execute function public.enqueue_withdrawal_email();

create or replace function public.enqueue_withdrawal_requested_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_name text;
begin
 select coalesce(nullif(p.email,''),u.email),coalesce(nullif(p.full_name,''),u.raw_user_meta_data->>'full_name','Seller')
 into v_email,v_name from auth.users u left join public.profiles p on p.id=u.id where u.id=new.seller_id;
 perform public.enqueue_transactional_email('seller-withdrawal:'||new.id::text||':requested',v_email,v_name,'seller.payout_requested',
 jsonb_build_object('amount',new.amount,'withdrawal_id',new.id,'wallet_url','https://eduwallethub.in/seller/wallet'));
 return new;
end; $$;
drop trigger if exists enqueue_withdrawal_requested_email on public.withdrawal_requests;
create trigger enqueue_withdrawal_requested_email after insert on public.withdrawal_requests for each row execute function public.enqueue_withdrawal_requested_email();

create or replace function public.enqueue_seller_suspension_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_name text;
begin
 if old.is_suspended is distinct from new.is_suspended then
  select coalesce(nullif(p.email,''),u.email),coalesce(nullif(p.full_name,''),u.raw_user_meta_data->>'full_name','Seller')
   into v_email,v_name from auth.users u left join public.profiles p on p.id=u.id where u.id=new.user_id;
  perform public.enqueue_transactional_email('seller-account-status:'||new.id::text||':'||case when new.is_suspended then 'suspended' else 'reinstated' end||':'||coalesce(new.suspended_at::text,now()::text),
   v_email,v_name,case when new.is_suspended then 'seller.account_suspended' else 'seller.account_reinstated' end,
   jsonb_build_object('reason',new.suspension_reason,'dashboard_url','https://eduwallethub.in/seller/dashboard'));
 end if; return new;
end; $$;
drop trigger if exists enqueue_seller_suspension_email on public.seller_applications;
create trigger enqueue_seller_suspension_email after update of is_suspended on public.seller_applications for each row execute function public.enqueue_seller_suspension_email();

create or replace function public.enqueue_buyer_order_email()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform public.enqueue_transactional_email('buyer-order-created:'||new.id::text,new.email,new.full_name,'buyer.order_received',
   jsonb_build_object('order_id',new.id,'product_title',new.product_title,'amount',new.amount,'order_url','https://eduwallethub.in/my-orders'));
 elsif old.payment_status is distinct from new.payment_status and new.payment_status='verified' then
  perform public.enqueue_transactional_email('buyer-order-paid:'||new.id::text,new.email,new.full_name,'buyer.payment_confirmed',
   jsonb_build_object('order_id',new.id,'product_title',new.product_title,'amount',new.amount,'order_url','https://eduwallethub.in/my-orders'));
 elsif old.order_status is distinct from new.order_status and new.order_status='payment_rejected' then
  perform public.enqueue_transactional_email('buyer-order-payment-rejected:'||new.id::text,new.email,new.full_name,'buyer.payment_rejected',
   jsonb_build_object('order_id',new.id,'product_title',new.product_title,'reason',new.admin_note,'order_url','https://eduwallethub.in/my-orders'));
 end if; return new;
end; $$;
drop trigger if exists enqueue_buyer_order_email on public.orders;
create trigger enqueue_buyer_order_email after insert or update of payment_status,order_status on public.orders for each row execute function public.enqueue_buyer_order_email();

create or replace function public.enqueue_buyer_delivery_email()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.order_status is distinct from new.order_status and new.order_status='delivered' then
  perform public.enqueue_transactional_email('buyer-order-delivered:'||new.id::text,new.email,new.full_name,'buyer.digital_delivery_confirmed',
   jsonb_build_object('order_id',new.id,'product_title',new.product_title,'order_url','https://eduwallethub.in/my-orders'));
 end if; return new;
end; $$;
drop trigger if exists enqueue_buyer_delivery_email on public.orders;
create trigger enqueue_buyer_delivery_email after update of order_status on public.orders for each row execute function public.enqueue_buyer_delivery_email();

create or replace function public.enqueue_buyer_refund_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype;
begin
 if old.status is distinct from new.status and new.status in ('processed','failed') then
  select * into v_order from public.orders where id=new.order_id;
  perform public.enqueue_transactional_email('buyer-refund:'||new.id::text||':'||new.status,v_order.email,v_order.full_name,
   case when new.status='processed' then 'buyer.refund_processed' else 'buyer.refund_failed' end,
   jsonb_build_object('order_id',new.order_id,'product_title',v_order.product_title,'amount',new.amount_paise::numeric/100,'reason',new.reason,'order_url','https://eduwallethub.in/my-orders'));
 end if; return new;
end; $$;
drop trigger if exists enqueue_buyer_refund_email on public.razorpay_refunds;
create trigger enqueue_buyer_refund_email after update of status on public.razorpay_refunds for each row execute function public.enqueue_buyer_refund_email();
commit;
