alter table public.blog_posts
  add column if not exists author_name text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists og_image text;

alter table public.blog_posts
  drop constraint if exists blog_posts_status_check;

alter table public.blog_posts
  add constraint blog_posts_status_check
  check (status in ('draft', 'scheduled', 'published'));

create index if not exists blog_posts_scheduled_at_idx
  on public.blog_posts (scheduled_at)
  where status = 'scheduled';
