create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_kind public.document_kind not null,
  encrypted_iv bytea not null check (octet_length(encrypted_iv) = 12),
  encrypted_payload bytea not null check (octet_length(encrypted_payload) > 16),
  encryption_key_version smallint not null default 1 check (encryption_key_version > 0),
  revision bigint not null default 1 check (revision > 0),
  client_mutation_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (workspace_id, client_mutation_id)
);

comment on table public.documents is 'Ciphertext-only business documents. AES-256-GCM payloads are decrypted only inside authorized Edge Functions.';
comment on column public.documents.encrypted_payload is 'AES-256-GCM ciphertext with its authentication tag; never plaintext JSON.';
