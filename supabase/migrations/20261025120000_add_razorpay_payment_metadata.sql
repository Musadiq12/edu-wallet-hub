-- Razorpay payment metadata for existing EduWallet Hub orders.
-- This migration is additive: it preserves the current manual-UPI workflow.
begin;

alter table public.orders
  add column if not exists payment_gateway text not null default 'manual_upi',
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature_verified_at timestamptz,
  add column if not exists razorpay_status text not null default 'created';

alter table public.orders
  add constraint orders_payment_gateway_check
    check (payment_gateway in ('manual_upi', 'razorpay')),
  add constraint orders_razorpay_status_check
    check (razorpay_status in ('created', 'paid', 'fulfilled', 'failed', 'partially_refunded', 'refunded'));

create unique index if not exists orders_razorpay_order_id_unique
  on public.orders (razorpay_order_id)
  where razorpay_order_id is not null;

create unique index if not exists orders_razorpay_payment_id_unique
  on public.orders (razorpay_payment_id)
  where razorpay_payment_id is not null;

create index if not exists orders_razorpay_recovery_idx
  on public.orders (razorpay_status, created_at)
  where payment_gateway = 'razorpay';

-- Webhook deliveries are recorded by event ID so retries cannot repeat side effects.
create table if not exists public.razorpay_webhook_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  event_type text not null,
  razorpay_order_id text,
  razorpay_payment_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

alter table public.razorpay_webhook_events enable row level security;
revoke all on public.razorpay_webhook_events from anon, authenticated;
grant all on public.razorpay_webhook_events to service_role;

-- Refunds are tracked separately to support full and partial refunds and audit history.
create table if not exists public.razorpay_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  razorpay_payment_id text not null,
  razorpay_refund_id text unique,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'requested'
    check (status in ('requested', 'processed', 'failed')),
  reason text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists razorpay_refunds_order_idx
  on public.razorpay_refunds (order_id, created_at desc);

alter table public.razorpay_refunds enable row level security;
revoke all on public.razorpay_refunds from anon, authenticated;
grant all on public.razorpay_refunds to service_role;

commit;
