-- Restore automatic customer profile/role bootstrap for Supabase Auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, whatsapp)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'whatsapp'
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        email = coalesce(excluded.email, public.profiles.email),
        whatsapp = coalesce(excluded.whatsapp, public.profiles.whatsapp);

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill accounts created while the trigger was missing.
insert into public.profiles (id, full_name, email, whatsapp)
select u.id, u.raw_user_meta_data->>'full_name', u.email, u.raw_user_meta_data->>'whatsapp'
from auth.users u
on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      whatsapp = coalesce(excluded.whatsapp, public.profiles.whatsapp);

insert into public.user_roles (user_id, role)
select u.id, 'user'::public.app_role
from auth.users u
where not exists (
  select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin'
)
on conflict (user_id, role) do nothing;