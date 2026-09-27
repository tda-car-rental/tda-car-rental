begin;

select plan(12);

create temporary table rls_fixture (
  workspace_id uuid not null,
  owner_id uuid not null,
  administrator_id uuid not null,
  bookkeeper_id uuid not null,
  outsider_id uuid not null,
  billing_id uuid not null,
  contract_id uuid not null
);

insert into rls_fixture
values (
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid()
);

insert into auth.users (id, email)
select owner_id, 'rls-owner@example.invalid' from rls_fixture
union all select administrator_id, 'rls-administrator@example.invalid' from rls_fixture
union all select bookkeeper_id, 'rls-bookkeeper@example.invalid' from rls_fixture
union all select outsider_id, 'rls-outsider@example.invalid' from rls_fixture;

insert into public.workspaces (id, name, created_by)
select workspace_id, 'RLS test workspace', owner_id from rls_fixture;

insert into public.workspace_members (workspace_id, user_id, role)
select workspace_id, owner_id, 'owner' from rls_fixture
union all select workspace_id, administrator_id, 'administrator' from rls_fixture
union all select workspace_id, bookkeeper_id, 'bookkeeper' from rls_fixture;

set local role authenticated;
select set_config('request.jwt.claim.sub', owner_id::text, true) from rls_fixture;

insert into public.documents (
  id, workspace_id, document_kind, encrypted_iv, encrypted_payload,
  client_mutation_id, created_by, updated_by
)
select billing_id, workspace_id, 'billing', decode('000000000000000000000000', 'hex'),
  decode('0000000000000000000000000000000000000000', 'hex'),
  gen_random_uuid(), owner_id, owner_id
from rls_fixture;

insert into public.documents (
  id, workspace_id, document_kind, encrypted_iv, encrypted_payload,
  client_mutation_id, created_by, updated_by
)
select contract_id, workspace_id, 'contract', decode('000000000000000000000000', 'hex'),
  decode('0000000000000000000000000000000000000000', 'hex'),
  gen_random_uuid(), owner_id, owner_id
from rls_fixture;

select ok(
  (select count(*) = 2 from public.documents),
  'owner can read all workspace documents'
);

select set_config('request.jwt.claim.sub', administrator_id::text, true) from rls_fixture;
select ok(
  (select count(*) = 2 from public.documents),
  'administrator can read all workspace documents'
);

select set_config('request.jwt.claim.sub', bookkeeper_id::text, true) from rls_fixture;
select ok(
  (select count(*) = 2 from public.documents),
  'bookkeeper can read all workspace documents'
);

select throws_ok(
  $$ insert into public.documents (
       workspace_id, document_kind, encrypted_iv, encrypted_payload,
       client_mutation_id, created_by, updated_by
     ) select workspace_id, 'contract', decode('000000000000000000000000', 'hex'),
       decode('0000000000000000000000000000000000000000', 'hex'),
       gen_random_uuid(), bookkeeper_id, bookkeeper_id from rls_fixture $$,
  '42501',
  'new row violates row-level security policy for table "documents"',
  'bookkeeper cannot create contracts'
);

select set_config('request.jwt.claim.sub', outsider_id::text, true) from rls_fixture;
select is((select count(*)::int from public.documents), 0, 'outsider cannot read the workspace');

select set_config('request.jwt.claim.sub', owner_id::text, true) from rls_fixture;
select ok(
  (select public.can_write_document(workspace_id, 'billing') from rls_fixture),
  'owner can write billing'
);

select set_config('request.jwt.claim.sub', administrator_id::text, true) from rls_fixture;
select ok(
  (select public.can_write_document(workspace_id, 'quotation') from rls_fixture),
  'administrator can write quotations'
);

select set_config('request.jwt.claim.sub', bookkeeper_id::text, true) from rls_fixture;
select ok(
  (select public.can_write_document(workspace_id, 'acknowledgement') from rls_fixture),
  'bookkeeper can write acknowledgements'
);
select ok(
  not (select public.can_write_document(workspace_id, 'contract') from rls_fixture),
  'bookkeeper cannot write contracts'
);

select set_config('request.jwt.claim.sub', outsider_id::text, true) from rls_fixture;
select ok(
  not (select public.can_read_document(workspace_id) from rls_fixture),
  'outsider has no document read capability'
);

select set_config('request.jwt.claim.sub', owner_id::text, true) from rls_fixture;
select lives_ok(
  $$ select public.write_audit_event(workspace_id, 'read', 'accepted') from rls_fixture $$,
  'authorized audit event writer does not expose payload data'
);

select finish();
rollback;
