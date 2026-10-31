-- Ensure the service-role-only moderation RPC can pass the seller application write guard.
-- The flag is transaction-local and the RPC is not executable by browser roles.
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
  v_full_name text;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected' using errcode = '22023';
  end if;

  if p_status = 'rejected' and length(btrim(coalesce(p_rejection_reason, ''))) < 3 then
    raise exception 'a rejection reason is required' using errcode = '22023';
  end if;

  perform set_config('app.seller_application_review', 'enabled', true);

  update public.seller_applications
  set status = p_status,
      rejection_reason = case when p_status = 'rejected' then btrim(p_rejection_reason) else null end,
      reviewed_at = now()
  where id = p_application_id and status = 'pending'
  returning user_id, full_name into v_user_id, v_full_name;

  if not found then
    raise exception 'seller application not found or already reviewed' using errcode = 'P0002';
  end if;

  if p_status = 'approved' then
    update public.profiles set role = 'seller' where id = v_user_id;
    if not found then
      raise exception 'applicant profile not found' using errcode = 'P0002';
    end if;

    insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
    values(v_user_id,'account_approved','Your seller account is approved',
      'Your EduWallet seller account has been verified. You can now publish products and manage sales.','/seller/dashboard');
  else
    insert into public.seller_notifications(seller_id,event_type,title,message,target_url)
    values(v_user_id,'account_rejected','Seller application update',
      'Your seller application was not approved. Reason: ' || left(btrim(p_rejection_reason),1000),'/become-seller');
  end if;
end;
$$;

revoke all on function public.server_review_seller_application(uuid,text,text) from public, anon, authenticated;
grant execute on function public.server_review_seller_application(uuid,text,text) to service_role;
