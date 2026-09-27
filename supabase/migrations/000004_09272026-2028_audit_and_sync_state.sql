create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('create', 'read', 'update', 'delete', 'sync', 'member_change')),
  result text not null check (result in ('accepted', 'rejected', 'conflict', 'failed')),
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null check (char_length(btrim(device_label)) between 1 and 120),
  cursor_updated_at timestamptz,
  cursor_document_id uuid,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, user_id, device_label)
);

create index audit_events_workspace_created_idx
  on public.audit_events (workspace_id, created_at desc, id desc);

create index sync_devices_user_workspace_idx
  on public.sync_devices (user_id, workspace_id, revoked_at, last_seen_at desc);

comment on table public.audit_events is 'Sanitized security/audit metadata only; document contents are never recorded.';
