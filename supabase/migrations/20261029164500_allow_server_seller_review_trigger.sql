-- Allow only the private service-role moderation RPC to pass the existing
-- seller application update trigger. The flag is transaction-local and is set
-- only inside server_review_seller_application below.
create or replace function public.guard_seller_application_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and current_setting('app.seller_application_review', true) = 'enabled' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid()
       or new.status <> 'pending'
       or new.reviewed_at is not null
       or new.rejection_reason is not null then
      raise exception 'Applications must be submitted by their owner as pending'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if public.is_admin_staff() then
      return new;
    end if;
    if old.user_id is distinct from auth.uid()
       or old.status <> 'rejected'
       or new.user_id is distinct from old.user_id
       or new.status <> 'pending'
       or new.reviewed_at is not null
       or new.rejection_reason is not null
       or new.pan_number is distinct from old.pan_number
       or new.bank_details is distinct from old.bank_details
       or new.qualification_proof_path is distinct from old.qualification_proof_path
       or new.created_at is distinct from old.created_at
       or new.id is distinct from old.id then
      raise exception 'Only rejected applications can be resubmitted by their owner'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.server_review_seller_application(
  p_application_id uuid,
  p_status text,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected' using errcode = '22023';
  end if;

  if p_status = 'rejected' and length(btrim(coalesce(p_rejection_reason, ''))) < 3 then
    raise exception 'a rejection reason is required' using errcode = '22023';
  end if;

  -- Bypasses only the seller-application update guard for this transaction.
  -- Function execution is granted exclusively to service_role; the caller action
  -- verifies the user's current profiles.role='admin' before invoking it.
  perform set_config('app.seller_application_review', 'enabled', true);

  update public.seller_applications
  set status = p_status,
      rejection_reason = case
        when p_status = 'rejected' then btrim(p_rejection_reason)
        else null
      end,
      reviewed_at = now()
  where id = p_application_id
    and status = 'pending'
  returning user_id into v_user_id;

  if not found then
    raise exception 'seller application not found or already reviewed' using errcode = 'P0002';
  end if;

  if p_status = 'approved' then
    update public.profiles set role = 'seller' where id = v_user_id;
    if not found then
      raise exception 'applicant profile not found' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

revoke all on function public.server_review_seller_application(uuid, text, text) from public, anon, authenticated;
grant execute on function public.server_review_seller_application(uuid, text, text) to service_role;
