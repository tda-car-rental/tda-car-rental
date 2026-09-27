begin;

-- Run this fixture in a local Supabase/PostgreSQL test database. It intentionally
-- uses deterministic ciphertext bytes because the performance target is the
-- indexed metadata scan, not plaintext decryption.
create temporary table performance_workspace (id uuid primary key);
insert into performance_workspace values (gen_random_uuid());

insert into auth.users (id, email)
select id, 'performance@example.invalid' from performance_workspace;

insert into public.workspaces (id, name, created_by)
select id, 'Performance workspace', id from performance_workspace;

insert into public.workspace_members (workspace_id, user_id, role)
select id, id, 'owner' from performance_workspace;

insert into public.documents (
  workspace_id,
  document_kind,
  encrypted_iv,
  encrypted_payload,
  encryption_key_version,
  revision,
  client_mutation_id,
  created_by,
  updated_by
)
select
  performance_workspace.id,
  case when series % 3 = 0 then 'billing'::public.document_kind
       when series % 3 = 1 then 'quotation'::public.document_kind
       else 'acknowledgement'::public.document_kind end,
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  1,
  1,
  gen_random_uuid(),
  performance_workspace.id,
  performance_workspace.id
from performance_workspace, generate_series(1, 100000) as series;

analyze public.documents;

-- Completion gate: capture EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) for each query
-- and assert p95 <= 3 seconds in the test runner. These statements must use the
-- documents_workspace_kind_updated_idx or documents_workspace_updated_idx index.
explain (analyze, buffers, format json)
select id, workspace_id, document_kind, encrypted_iv, encrypted_payload,
       encryption_key_version, revision, updated_at
from public.documents
where workspace_id = (select id from performance_workspace)
  and document_kind = 'billing'
  and deleted_at is null
order by updated_at desc, id desc
limit 251;

explain (analyze, buffers, format json)
select id, workspace_id, document_kind, encrypted_iv, encrypted_payload,
       encryption_key_version, revision, updated_at
from public.documents
where workspace_id = (select id from performance_workspace)
  and deleted_at is null
order by updated_at desc, id desc
limit 251;

rollback;
