-- Multi-item order foundation. Additive only: legacy orders remain readable and payable.
-- Checkout/payment code must populate snapshots from server-validated catalog data.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_type text not null check (product_type in ('pdf', 'physical')),
  product_title text not null check (length(btrim(product_title)) between 1 and 300),
  product_slug text,
  seller_id uuid references auth.users(id) on delete set null,
  quantity integer not null check (quantity between 1 and 100),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_subtotal numeric(12,2) not null check (line_subtotal >= 0),
  coupon_discount numeric(12,2) not null default 0 check (coupon_discount >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'processing', 'delivered', 'dispatched', 'cancelled', 'failed')),
  inventory_reserved boolean not null default false,
  inventory_deducted boolean not null default false,
  inventory_released boolean not null default false,
  delivered_at timestamptz,
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_price_math check (
    line_subtotal = round(unit_price * quantity, 2)
    and coupon_discount <= line_subtotal
    and line_total = round(line_subtotal - coupon_discount, 2)
  )
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_items_seller_id_idx on public.order_items(seller_id);
create index if not exists order_items_fulfillment_status_idx on public.order_items(fulfillment_status);

alter table public.order_items enable row level security;

-- No direct client writes: trusted checkout/webhook code uses the service role.
-- Read access will be granted through a narrowly scoped ownership policy in the
-- follow-up integration migration after the existing admin/seller policy helpers
-- and customer order-access rules are wired into the application.
revoke all on table public.order_items from anon, authenticated;
grant select, insert, update, delete on table public.order_items to service_role;
