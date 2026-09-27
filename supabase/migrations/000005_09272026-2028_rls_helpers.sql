create or replace function public.is_active_member(
  target_workspace_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
      and wm.active = true
  );
$$;

create or replace function public.member_role(
  target_workspace_id uuid,
  target_user_id uuid default auth.uid()
)
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select wm.role
  from public.workspace_members as wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = target_user_id
    and wm.active = true
  limit 1;
$$;

create or replace function public.can_read_document(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_active_member(target_workspace_id);
$$;

create or replace function public.can_write_document(
  target_workspace_id uuid,
  target_kind public.document_kind
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.is_active_member(target_workspace_id)
    and (
      public.member_role(target_workspace_id) in ('owner', 'administrator')
      or (public.member_role(target_workspace_id) = 'bookkeeper' and target_kind in ('billing', 'quotation', 'acknowledgement'))
    );
$$;

create or replace function public.can_manage_members(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.member_role(target_workspace_id) = 'owner';
$$;

create or replace function public.write_audit_event(
  target_workspace_id uuid,
  target_action text,
  target_result text,
  target_document_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_active_member(target_workspace_id) then
    raise exception using errcode = '42501', message = 'Forbidden';
  end if;

  insert into public.audit_events (workspace_id, actor_user_id, action, result, document_id)
  values (target_workspace_id, auth.uid(), target_action, target_result, target_document_id);
end;
$$;

revoke all on function public.is_active_member(uuid, uuid) from public;
revoke all on function public.member_role(uuid, uuid) from public;
revoke all on function public.can_read_document(uuid) from public;
revoke all on function public.can_write_document(uuid, public.document_kind) from public;
revoke all on function public.can_manage_members(uuid) from public;
revoke all on function public.write_audit_event(uuid, text, text, uuid) from public;

grant execute on function public.is_active_member(uuid, uuid) to authenticated;
grant execute on function public.member_role(uuid, uuid) to authenticated;
grant execute on function public.can_read_document(uuid) to authenticated;
grant execute on function public.can_write_document(uuid, public.document_kind) to authenticated;
grant execute on function public.can_manage_members(uuid) to authenticated;
grant execute on function public.write_audit_event(uuid, text, text, uuid) to authenticated;
