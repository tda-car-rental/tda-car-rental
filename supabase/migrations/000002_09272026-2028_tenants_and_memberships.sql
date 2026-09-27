create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_active_idx
  on public.workspace_members (user_id, active, workspace_id);

create index workspace_members_workspace_active_idx
  on public.workspace_members (workspace_id, active, role, user_id);

comment on table public.workspace_members is 'One active fixed-role membership per user and workspace.';
