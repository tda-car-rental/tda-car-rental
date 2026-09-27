alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;
alter table public.documents enable row level security;
alter table public.documents force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.sync_devices enable row level security;
alter table public.sync_devices force row level security;

create policy workspaces_select_member
  on public.workspaces for select to authenticated
  using (public.is_active_member(id));

create policy workspaces_update_owner
  on public.workspaces for update to authenticated
  using (public.member_role(id) = 'owner')
  with check (public.member_role(id) = 'owner');

create policy workspace_members_select_member
  on public.workspace_members for select to authenticated
  using (public.is_active_member(workspace_id));

create policy workspace_members_insert_owner
  on public.workspace_members for insert to authenticated
  with check (public.can_manage_members(workspace_id));

create policy workspace_members_update_owner
  on public.workspace_members for update to authenticated
  using (public.can_manage_members(workspace_id))
  with check (public.can_manage_members(workspace_id));

create policy workspace_members_delete_owner
  on public.workspace_members for delete to authenticated
  using (public.can_manage_members(workspace_id));

create policy documents_select_member
  on public.documents for select to authenticated
  using (public.can_read_document(workspace_id));

create policy documents_insert_authorized
  on public.documents for insert to authenticated
  with check (
    public.can_write_document(workspace_id, document_kind)
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

create policy documents_update_authorized
  on public.documents for update to authenticated
  using (public.can_write_document(workspace_id, document_kind))
  with check (
    public.can_write_document(workspace_id, document_kind)
    and updated_by = auth.uid()
  );

create policy documents_delete_authorized
  on public.documents for delete to authenticated
  using (public.can_write_document(workspace_id, document_kind));

create policy audit_events_select_admin
  on public.audit_events for select to authenticated
  using (public.member_role(workspace_id) in ('owner', 'administrator'));

create policy sync_devices_select_self
  on public.sync_devices for select to authenticated
  using (user_id = auth.uid() and public.is_active_member(workspace_id));

create policy sync_devices_insert_self
  on public.sync_devices for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_member(workspace_id));

create policy sync_devices_update_self
  on public.sync_devices for update to authenticated
  using (user_id = auth.uid() and public.is_active_member(workspace_id))
  with check (user_id = auth.uid() and public.is_active_member(workspace_id));

create policy sync_devices_delete_self
  on public.sync_devices for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.workspaces, public.workspace_members, public.documents, public.audit_events, public.sync_devices from anon;
revoke all on public.audit_events from authenticated;
grant select on public.workspaces, public.workspace_members, public.documents, public.sync_devices to authenticated;
grant insert, update, delete on public.documents to authenticated;
grant insert, update, delete on public.sync_devices to authenticated;
