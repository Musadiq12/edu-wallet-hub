-- Allow guests to browse active products without invoking admin authorization logic.
-- Keep admin visibility/authorization separate for authenticated users.

drop policy if exists "public read active products" on public.products;
drop policy if exists "authenticated read active products" on public.products;

create policy "public read active products"
on public.products
for select
to anon
using (is_active and not is_archived);

create policy "authenticated read active products"
on public.products
for select
to authenticated
using (
  (is_active and not is_archived)
  or public.has_role(auth.uid(), 'admin')
);
