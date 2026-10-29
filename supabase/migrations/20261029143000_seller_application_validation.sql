-- Server-side validation and safe resubmission for seller applications.
-- Seller application file uploads remain protected by Storage RLS and the private bucket.
begin;

-- These fields are captured in the application only; PAN and qualification proof stay optional
-- and are not collected by the Become a Seller form.
alter table public.seller_applications
  alter column pan_number drop not null,
  alter column qualification_proof_path drop not null;

alter table public.seller_applications
  add column if not exists exams text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.seller_applications'::regclass
      and conname='seller_applications_exams_check'
  ) then
    alter table public.seller_applications
      add constraint seller_applications_exams_check
      check (exams <@ array['NEET','JEE','UPSC','SSC','CGL','CLAT','CA','Other']::text[]) not valid;
  end if;
end $$;
alter table public.seller_applications validate constraint seller_applications_exams_check;

-- Database-side checks are the final validation boundary, not only browser validation.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.seller_applications'::regclass
      and conname='seller_applications_full_name_check'
  ) then
    alter table public.seller_applications add constraint seller_applications_full_name_check
      check (length(btrim(full_name)) between 2 and 100) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.seller_applications'::regclass
      and conname='seller_applications_profession_check'
  ) then
    alter table public.seller_applications add constraint seller_applications_profession_check
      check (length(btrim(profession)) between 1 and 100) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.seller_applications'::regclass
      and conname='seller_applications_education_check'
  ) then
    alter table public.seller_applications add constraint seller_applications_education_check
      check (length(btrim(education)) between 1 and 200) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.seller_applications'::regclass
      and conname='seller_applications_upi_id_check'
  ) then
    alter table public.seller_applications add constraint seller_applications_upi_id_check
      check (upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$') not valid;
  end if;
end $$;
alter table public.seller_applications validate constraint seller_applications_full_name_check;
alter table public.seller_applications validate constraint seller_applications_profession_check;
alter table public.seller_applications validate constraint seller_applications_education_check;
alter table public.seller_applications validate constraint seller_applications_upi_id_check;

-- Keep INSERT restricted to a new pending application. Rejected applicants may only update
-- their own rejected row and must reset moderation fields; status/role cannot be assigned freely.
drop policy if exists seller_applications_resubmit_rejected on public.seller_applications;
create policy seller_applications_resubmit_rejected on public.seller_applications
for update to authenticated
using (user_id=(select auth.uid()) and status='rejected')
with check (user_id=(select auth.uid()) and status='pending' and reviewed_at is null and rejection_reason is null);

create or replace function public.guard_seller_application_write()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    if new.user_id is distinct from auth.uid()
       or new.status <> 'pending'
       or new.reviewed_at is not null
       or new.rejection_reason is not null then
      raise exception 'Applications must be submitted by their owner as pending'
        using errcode='42501';
    end if;
  elsif tg_op='UPDATE' then
    if public.is_admin_staff() then
      return new;
    end if;
    if old.user_id is distinct from auth.uid()
       or old.status <> 'rejected'
       or new.user_id is distinct from old.user_id
       or new.status <> 'pending'
       or new.reviewed_at is not null
       or new.rejection_reason is not null then
      raise exception 'Only rejected applications can be resubmitted by their owner'
        using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_seller_application_write on public.seller_applications;
create trigger guard_seller_application_write
before insert or update on public.seller_applications
for each row execute function public.guard_seller_application_write();

-- Update grants are narrow; RLS + the trigger restrict updates to rejected -> pending by the same owner.
grant update (full_name, profession, education, exams, id_card_path, upi_id, status, rejection_reason, reviewed_at)
on public.seller_applications to authenticated;

commit;
