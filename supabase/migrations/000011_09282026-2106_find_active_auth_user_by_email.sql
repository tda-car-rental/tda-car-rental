create or replace function public.find_auth_user_by_email(target_email text)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = pg_catalog, auth, public
as $$
  select au.id, au.email
  from auth.users as au
  where au.email is not null
    and au.deleted_at is null
    and lower(au.email) = lower(btrim(target_email))
  order by au.created_at desc
  limit 1;
$$;

revoke all on function public.find_auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_by_email(text) to service_role;
