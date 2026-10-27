-- Configurable announcement bar. One row avoids partially-saved settings.
create table if not exists public.announcement_bar_config (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  messages jsonb not null default '[{"id":"default-news","text":"New resources added daily","url":"","icon":"📚","startAt":null,"endAt":null}]'::jsonb,
  speed_seconds integer not null default 28 check (speed_seconds between 12 and 90),
  direction text not null default 'left' check (direction in ('left','right')),
  background_color text not null default '#123B63' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text not null default '#FFFFFF' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'UTC' check (timezone in ('UTC','Asia/Kolkata')),
  updated_at timestamptz not null default now()
);
alter table public.announcement_bar_config enable row level security;
drop policy if exists "announcement config public read" on public.announcement_bar_config;
create policy "announcement config public read" on public.announcement_bar_config for select to anon, authenticated using (true);
drop policy if exists "announcement config admin write" on public.announcement_bar_config;
create policy "announcement config admin write" on public.announcement_bar_config for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
grant select on public.announcement_bar_config to anon, authenticated;
grant insert, update, delete on public.announcement_bar_config to authenticated;
insert into public.announcement_bar_config (id) values (true) on conflict (id) do nothing;

-- Consent policy and banner copy are public configuration; mutation remains admin-only.
create table if not exists public.cookie_consent_config (
  id boolean primary key default true check (id),
  policy_version text not null default '2026-10-v1' check (length(policy_version) between 1 and 40),
  consent_days integer not null default 180 check (consent_days between 180 and 365),
  banner_title text not null default 'Your privacy choices',
  banner_text text not null default 'We use essential storage to run this website. Optional analytics, functional features and advertising technologies stay off unless you choose to enable them.',
  privacy_path text not null default '/privacy' check (privacy_path in ('/privacy')),
  cookie_path text not null default '/cookies' check (cookie_path in ('/cookies')),
  updated_at timestamptz not null default now()
);
alter table public.cookie_consent_config enable row level security;
drop policy if exists "cookie consent config public read" on public.cookie_consent_config;
create policy "cookie consent config public read" on public.cookie_consent_config for select to anon, authenticated using (true);
drop policy if exists "cookie consent config admin write" on public.cookie_consent_config;
create policy "cookie consent config admin write" on public.cookie_consent_config for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
grant select on public.cookie_consent_config to anon, authenticated;
grant insert, update, delete on public.cookie_consent_config to authenticated;
insert into public.cookie_consent_config (id) values (true) on conflict (id) do nothing;

-- Browser consent records are anonymous preference data. No identity or IP is collected here.
create table if not exists public.cookie_consent_records (
  id uuid primary key default gen_random_uuid(),
  consent_id text not null,
  policy_version text not null,
  categories jsonb not null check (jsonb_typeof(categories) = 'object'),
  jurisdiction text not null default 'unknown' check (jurisdiction in ('eea','uk','ch','us','other','unknown')),
  created_at timestamptz not null default now()
);
alter table public.cookie_consent_records enable row level security;
revoke all on public.cookie_consent_records from anon, authenticated;
grant insert on public.cookie_consent_records to anon, authenticated;
drop policy if exists "anonymous may record consent" on public.cookie_consent_records;
create policy "anonymous may record consent" on public.cookie_consent_records
  for insert to anon, authenticated
  with check (
    length(consent_id) between 20 and 80
    and length(policy_version) between 1 and 40
    and jsonb_typeof(categories) = 'object'
    and categories ?& array['necessary','analytics','marketing','functional']
    and categories->>'necessary' = 'true'
  );

-- No third-party tracking is performed by this table; avoid adding identifying columns.
