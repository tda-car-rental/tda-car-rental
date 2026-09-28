alter table public.workspace_members
  add column email text;

alter table public.workspace_members
  add constraint workspace_members_email_length
  check (email is null or char_length(btrim(email)) between 3 and 320);

create index workspace_members_workspace_page_idx
  on public.workspace_members (workspace_id, created_at desc, user_id desc);

create or replace function public.can_manage_members(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.member_role(target_workspace_id) in ('owner', 'administrator');
$$;

drop policy workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_self
  on public.workspace_members for select to authenticated
  using (user_id = auth.uid() and active = true);

create policy workspace_members_select_admin
  on public.workspace_members for select to authenticated
  using (public.can_manage_members(workspace_id));

drop policy workspace_members_insert_owner on public.workspace_members;
create policy workspace_members_insert_admin
  on public.workspace_members for insert to authenticated
  with check (
    public.can_manage_members(workspace_id)
    and role in ('administrator', 'bookkeeper')
  );

drop policy workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_admin
  on public.workspace_members for update to authenticated
  using (public.can_manage_members(workspace_id))
  with check (
    public.can_manage_members(workspace_id)
    and role in ('administrator', 'bookkeeper')
  );

drop policy workspace_members_delete_owner on public.workspace_members;
create policy workspace_members_delete_admin
  on public.workspace_members for delete to authenticated
  using (public.can_manage_members(workspace_id));
