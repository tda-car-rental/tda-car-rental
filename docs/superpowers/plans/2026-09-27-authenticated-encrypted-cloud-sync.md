# Authenticated Encrypted Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add required email/password login, role-based access, AES-256-GCM encrypted Supabase Edge Function document sync, encrypted offline storage, and strict PostgreSQL RLS for web and Electron clients, with an Android-compatible API contract.

**Architecture:** React/TanStack Start remains the UI layer and performs no database queries. It uses Supabase Auth for sessions and authenticated HTTP calls to versioned Edge Functions. Edge Functions validate the caller, encrypt/decrypt in memory, and use the caller JWT for Postgres operations so RLS remains active. The Electron main process and browser storage adapters provide encrypted local cache/outbox support; PostgreSQL uses ciphertext-only document payloads plus indexed sync metadata.

**Tech Stack:** React 19, TanStack Router/Start, Electron isolated preload, TypeScript, Supabase Auth, Supabase Edge Functions on Deno, PostgreSQL/RLS, Web Crypto AES-256-GCM, encrypted Electron OS storage, IndexedDB, Vitest, ESLint, Vite, and existing Tailwind/shadcn components.

## Global Constraints

- All SQL migration files are immutable after creation. Never edit an existing `supabase/migrations/*.sql`; every correction is a new migration with a higher sequence number. Every filename uses `NNNNNN_MMDDYYYY-HHmm_purpose.sql`, with the six-digit sequence, creation date, and 24-hour creation time in Asia/Manila.
- The frontend must not issue database queries or import a database client. Renderer code may call Auth and Edge Function HTTP APIs only.
- Billing, quotation, and acknowledgement business fields must never be stored as plaintext in Supabase Postgres, logs, audit events, or analytics.
- AES-256-GCM uses a 32-byte Edge Function secret, a fresh random 12-byte IV for every write, authenticated ciphertext, and explicit key versions.
- Postgres access from document Edge Functions must forward the caller JWT; the service-role key is forbidden for document CRUD.
- Roles are exactly `owner`, `administrator`, and `bookkeeper`; server authorization and RLS are authoritative over UI visibility.
- Login is required before application access. MVP authentication is Supabase email/password with no MFA and no public signup.
- The first Owner is provisioned manually in Supabase.
- Offline access is allowed only after a successful login on that device and uses encrypted cache/outbox storage.
- List/search endpoints use indexed keyset pagination, server-side filtering/aggregation, bounded response sizes, and client virtualization. No Redis, Elasticsearch, or other external infrastructure is introduced.
- The performance gate is p95 <= 3 seconds for first-page/search/summary API operations over a seeded 100,000-document workspace, with the complete result browsable by cursors without rendering 100,000 DOM nodes.
- Preserve existing UI/UX, routes, PDF behavior, Electron isolation, and test coverage.
- Preserve the already existing user changes in `frontend/src/electron/static/loading.html`, `frontend/src/routes/__root.tsx`, `frontend/public/icon.png`, and `frontend/release-icon-check/`.
- Complete at least 42 coherent implementation commits. The design-document commit `73c92bf` does not count toward these implementation commits.

## File Map

### Supabase backend

- Create `supabase/config.toml` for local Edge Function configuration.
- Create immutable SQL files under `supabase/migrations/NNNNNN_MMDDYYYY-HHmm_purpose.sql` for extensions, tenant tables, ciphertext documents, helper functions, RLS policies, grants, and indexes.
- Create `supabase/functions/_shared/http.ts`, `auth.ts`, `crypto.ts`, `validation.ts`, `roles.ts`, `documents.ts`, and `errors.ts` for reusable Edge Function boundaries.
- Create `supabase/functions/documents/index.ts`, `supabase/functions/sync/index.ts`, `supabase/functions/workspace-context/index.ts`, and `supabase/functions/members/index.ts` for the public function endpoints.
- Create `supabase/tests/rls.sql`, `supabase/tests/functions.test.ts`, and `supabase/tests/performance.sql` for database, function, and performance verification.

### Frontend and Electron

- Create `frontend/src/lib/config.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/cloud-api.ts`, `frontend/src/lib/cloud-types.ts`, `frontend/src/lib/local-cache.ts`, `frontend/src/lib/sync-engine.ts`, and `frontend/src/lib/document-store.ts` as browser/Electron-neutral boundaries.
- Create `frontend/src/components/auth/LoginPage.tsx`, `frontend/src/components/auth/AuthGate.tsx`, `frontend/src/components/auth/RoleGate.tsx`, `frontend/src/components/sync/SyncStatus.tsx`, and `frontend/src/components/sync/ConflictDialog.tsx` while reusing current UI primitives.
- Modify `frontend/src/routes/__root.tsx`, `frontend/src/router.tsx`, `frontend/src/components/AppLayout.tsx`, `frontend/src/components/DocList.tsx`, `frontend/src/components/DocumentEditor.tsx`, `frontend/src/components/DocumentEditorPage.tsx`, and `frontend/src/routes/index.tsx` to consume API/store interfaces rather than direct database calls.
- Modify `frontend/src/electron/preload.cts`, `frontend/src/lib/electron-api.d.ts`, `frontend/src/electron/main/ipc.ts`, and `frontend/src/electron/main/document-database.ts` for encrypted local cache and explicit legacy import.
- Create `frontend/tests/unit/cloud/*`, `frontend/tests/unit/sync/*`, `frontend/tests/component/auth/*`, `frontend/tests/component/sync/*`, `frontend/tests/architecture/no-frontend-database-query.test.ts`, and `frontend/tests/performance/cloud-api-benchmark.test.ts`.

### Tooling and documentation

- Create `scripts/verify-supabase-migrations.mjs` and `scripts/benchmark-document-api.mjs`.
- Modify `frontend/package.json`, `frontend/package-lock.json`, `frontend/README.md`, root `README.md`, and `.github/workflows/ci.yml`.
- Create `supabase/migrations/MIGRATION_POLICY.md` documenting the append-only rule without changing SQL after creation.

## Commit-by-Commit Tasks

Each task below is one implementation commit. Run the listed test/check before committing. Do not combine commits or edit an earlier migration after its commit.

### Task 1: Normalize repository-root documentation

**Files:** Modify `README.md`; create root `.gitignore` only if required by the relocated worktree; preserve `frontend/` source changes.

- [ ] Add root instructions that the application lives in `frontend/`, Supabase assets live in `supabase/`, and commands run from `frontend/`.
- [ ] Verify `git rev-parse --show-toplevel` is the project root and `git status --short` contains only the known relocation/user changes.
- [ ] Run `git diff --check`.
- [ ] Commit `chore: document repository root layout`.

### Task 2: Add frontend cloud dependencies and environment boundary

**Files:** Modify `frontend/package.json`, `frontend/package-lock.json`; create `frontend/src/lib/config.ts`.

- [ ] Add `@supabase/supabase-js` only for Auth and Edge Function invocation; do not use its `.from()` API in frontend code.
- [ ] Define `SupabaseConfig` and read only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, rejecting missing values with a user-safe error.
- [ ] Add tests for missing and valid configuration in `frontend/tests/unit/cloud/config.test.ts`.
- [ ] Run `npm install --package-lock-only` and `npm test -- --run frontend/tests/unit/cloud/config.test.ts` from `frontend/`.
- [ ] Commit `feat: add cloud configuration boundary`.

### Task 3: Add immutable migration verification tooling

**Files:** Create `scripts/verify-supabase-migrations.mjs`, `supabase/migrations/MIGRATION_POLICY.md`; modify root `package.json` only if a root script is required.

- [ ] Implement a script that enforces `^\\d{6}_\\d{8}-\\d{4}_[a-z0-9_]+\\.sql$`, rejects edits to tracked existing migration files, rejects duplicate/non-increasing numeric prefixes, and permits only new append-only migration files.
- [ ] Make the local check compare the working tree against `HEAD`; make CI mode compare against the checked-out base ref.
- [ ] Document that changing an existing `.sql` file is forbidden and that fixes require a new numbered migration.
- [ ] Test the script with a temporary new migration name and a temporary modified tracked migration fixture without changing real migration files.
- [ ] Commit `chore: enforce immutable supabase migrations`.

### Task 4: Add Supabase local configuration

**Files:** Create `supabase/config.toml`.

- [ ] Configure Auth, database, and Edge Function local ports without embedding secrets.
- [ ] Configure functions for JWT-bearing requests and CORS handled in code.
- [ ] Run the migration verifier and parse the TOML with the Supabase CLI if installed; otherwise run the repository’s TOML validation check.
- [ ] Commit `chore: configure supabase local services`.

### Task 5: Create immutable extension and enum migration

**Files:** Create one new `supabase/migrations/NNNNNN_MMDDYYYY-HHmm_extensions_and_enums.sql` using the actual Asia/Manila creation timestamp.

- [ ] Enable required UUID/crypto support and create `app_role` and `document_kind` enums with exact values `owner`, `administrator`, `bookkeeper`, `billing`, `quotation`, `acknowledgement`, and `contract`.
- [ ] Add `COMMENT ON` statements that describe security intent without sensitive values.
- [ ] Run the migration verifier and SQL parser; never modify this file after commit.
- [ ] Commit `feat: add tenant role and document kind types`.

### Task 6: Create immutable tenant and membership migration

**Files:** Create one new `supabase/migrations/NNNNNN_MMDDYYYY-HHmm_tenants_and_memberships.sql` using the actual Asia/Manila creation timestamp.

- [ ] Create `workspaces` and `workspace_members` with UUID keys, `auth.users` references, active status, timestamps, exact role check, and unique `(workspace_id, user_id)`.
- [ ] Add constraints preventing null roles and inactive membership ambiguity.
- [ ] Add indexes for `(user_id, active)`, `(workspace_id, active)`, and role filtering.
- [ ] Run SQL verification and commit without future edits as `feat: add workspace membership schema`.

### Task 7: Create immutable ciphertext document migration

**Files:** Create one new `supabase/migrations/NNNNNN_MMDDYYYY-HHmm_encrypted_documents.sql` using the actual Asia/Manila creation timestamp.

- [ ] Create `documents` with UUID, workspace ID, `document_kind`, `encrypted_iv`, `encrypted_payload`, key version, revision, mutation ID, audit timestamps, and soft-delete state.
- [ ] Use `bytea` for IV and ciphertext, `smallint` for key version, `bigint` for revision, and checks for 12-byte IV and positive revision.
- [ ] Keep all business fields out of the table; add a comment explicitly stating that payloads are AES-256-GCM ciphertext.
- [ ] Run SQL verification and commit `feat: add ciphertext-only document storage`.

### Task 8: Create immutable audit and sync-state migration

**Files:** Create one new `supabase/migrations/NNNNNN_MMDDYYYY-HHmm_audit_and_sync_state.sql` using the actual Asia/Manila creation timestamp.

- [ ] Create `audit_events` without payload columns and `sync_devices` with device ID, user ID, workspace ID, cursor, last-seen time, and revocation state.
- [ ] Add foreign keys, bounded action/result checks, and indexes for workspace/time and user/device lookup.
- [ ] Verify no column can store document plaintext and commit `feat: add sanitized audit and sync state`.

### Task 9: Create immutable RLS helper-function migration

**Files:** Create one new `supabase/migrations/NNNNNN_MMDDYYYY-HHmm_rls_helpers.sql` using the actual Asia/Manila creation timestamp.

- [ ] Create fixed-search-path `SECURITY DEFINER` helpers for active membership, role lookup, document read, document write, and member administration.
- [ ] Use `auth.uid()` and schema-qualified `public` references; return false on missing/inactive membership.
- [ ] Revoke public execute and grant only the minimum authenticated execution needed by policies.
- [ ] Add SQL tests for cross-workspace and inactive-member denial, then commit `feat: add hardened rls helper functions`.

### Task 10: Create immutable RLS policies and grants migration

**Files:** Create one new `supabase/migrations/NNNNNN_MMDDYYYY-HHmm_rls_policies.sql` using the actual Asia/Manila creation timestamp.

- [ ] Enable and force RLS on every application table.
- [ ] Add policies for workspace membership, documents, audit events, and sync devices matching the role matrix; Bookkeeper document writes are limited to financial kinds and contract reads are read-only.
- [ ] Revoke broad anon access, grant authenticated least privilege, and deny service-role use from client code by configuration/documentation.
- [ ] Run policy SQL checks and commit `feat: enforce strict workspace rls`.

### Task 11: Add immutable query-performance indexes

**Files:** Create one new `supabase/migrations/NNNNNN_MMDDYYYY-HHmm_document_query_indexes.sql` using the actual Asia/Manila creation timestamp.

- [ ] Add composite indexes for workspace/kind/updated-time/UUID keyset scans, active membership lookup, mutation idempotency, and dashboard aggregates.
- [ ] Use partial indexes for non-deleted documents where that improves the query plan.
- [ ] Run `EXPLAIN` fixtures against a 100,000-row generated test dataset and commit `perf: index document keyset queries`.

### Task 12: Add RLS SQL test harness

**Files:** Create `supabase/tests/rls.sql`.

- [ ] Define test users/workspaces and assertions for Owner, Administrator, Bookkeeper, inactive member, anonymous, cross-workspace, and direct table access.
- [ ] Assert Bookkeeper cannot mutate contracts or membership rows and cannot read another workspace.
- [ ] Run with `supabase db test` or the project’s documented local Postgres test command and commit `test: cover strict rls role matrix`.

### Task 13: Add backend crypto tests first

**Files:** Create `supabase/functions/_shared/crypto.test.ts`.

- [ ] Write failing tests for AES-256-GCM round trip, random 12-byte IV, tamper rejection, wrong-key rejection, key-version mismatch, and malformed base64 rejection.
- [ ] Run the focused Deno/Vitest test and record the expected failures.
- [ ] Commit `test: define edge encryption contract`.

### Task 14: Implement backend AES-256-GCM crypto

**Files:** Create `supabase/functions/_shared/crypto.ts`; modify `supabase/functions/_shared/crypto.test.ts` only to finish assertions.

- [ ] Implement `encryptJson(value, keyMaterial, keyVersion)` and `decryptJson(record, keyMaterial)` using `crypto.subtle`, 32-byte keys, random 12-byte IVs, authenticated ciphertext, and strict JSON parsing.
- [ ] Never log key material or plaintext; zero references after operation where the runtime allows it.
- [ ] Run crypto tests and commit `feat: implement edge aes-gcm encryption`.

### Task 15: Define validated cloud document types

**Files:** Create `supabase/functions/_shared/validation.ts`, `frontend/src/lib/cloud-types.ts`.

- [ ] Define the shared document input shape matching existing billing, quotation, and acknowledgement editors.
- [ ] Validate document kind, bounded string lengths, finite numeric totals, item counts, item amounts, dates, and request size before encryption.
- [ ] Add identical invalid-payload tests on backend and frontend; commit `feat: validate cloud document payloads`.

### Task 16: Add secure Edge Function HTTP primitives

**Files:** Create `supabase/functions/_shared/http.ts`, `supabase/functions/_shared/errors.ts`.

- [ ] Implement allowlisted CORS, JSON content-type enforcement, request-size limits, stable error codes, no stack traces, and redacted error logging.
- [ ] Reject missing/invalid bearer headers before parsing document bodies.
- [ ] Test OPTIONS, invalid origins, oversized bodies, generic errors, and missing auth; commit `feat: add secure edge http boundary`.

### Task 17: Add caller authorization context

**Files:** Create `supabase/functions/_shared/auth.ts`, `supabase/functions/_shared/roles.ts`.

- [ ] Implement `requireUser`, `requireWorkspaceMember`, and `requireRole` using the forwarded JWT and caller-scoped Supabase client.
- [ ] Return only workspace ID and role needed by handlers; do not expose membership details for unauthorized workspaces.
- [ ] Test expired tokens, inactive members, wrong workspace, and role boundaries; commit `feat: authorize edge callers by workspace role`.

### Task 18: Implement caller-scoped document repository reads

**Files:** Create `supabase/functions/_shared/documents.ts`.

- [ ] Implement repository methods for keyset page, one document, and aggregate summary using parameterized Supabase query-builder calls in the backend only.
- [ ] Select ciphertext and metadata only, constrain workspace/kind/deleted state, order by indexed `(updated_at DESC, id DESC)`, and cap limits at 250.
- [ ] Add query-shape tests asserting no plaintext field selection and commit `feat: add indexed document reads`.

### Task 19: Implement encrypted document repository writes

**Files:** Modify `supabase/functions/_shared/documents.ts`; create `supabase/functions/_shared/idempotency.ts`.

- [ ] Implement create/update/delete with expected revision, stable mutation ID, encrypted payload fields, and atomic conflict detection.
- [ ] Return `CONFLICT` with ciphertext metadata only from the repository; decryption remains in the function handler after authorization.
- [ ] Test duplicate mutation replay, stale revision, delete/restore rules, and commit `feat: add revision-safe document writes`.

### Task 20: Implement documents Edge Function

**Files:** Create `supabase/functions/documents/index.ts`.

- [ ] Implement authenticated `GET` list/get and `POST` create/update/delete operations with validated input, role checks, in-memory AES-GCM, sanitized audit entries, and caller-scoped database access.
- [ ] Decrypt only rows already authorized by RLS and return bounded pages; never use service role.
- [ ] Test authorized/unauthorized reads and writes plus tampered ciphertext behavior; commit `feat: expose encrypted document edge api`.

### Task 21: Implement sync Edge Function

**Files:** Create `supabase/functions/sync/index.ts`.

- [ ] Implement push of one mutation at a time, cursor-based pull, idempotent acknowledgements, conflict response, and device registration/revocation checks.
- [ ] Use the same encryption and revision repository; keep response pages bounded and ordered by indexed cursor fields.
- [ ] Test retries, reconnects, conflicts, and revoked devices; commit `feat: add single-flight sync endpoint`.

### Task 22: Implement workspace-context Edge Function

**Files:** Create `supabase/functions/workspace-context/index.ts`.

- [ ] Return the authenticated user's active workspace, role, and capability flags without document payloads.
- [ ] Reject users without an active membership and do not expose workspace names from another workspace.
- [ ] Test bootstrap Owner, member, inactive member, and no-membership cases; commit `feat: expose authenticated workspace context`.

### Task 23: Implement owner-scoped member administration

**Files:** Create `supabase/functions/members/index.ts`.

- [ ] Implement Owner-only invite/create, deactivate, reactivate, and role assignment operations using service role only for Auth administration after caller authorization.
- [ ] Prevent removing the last Owner, changing Owner security settings, duplicate active membership, and arbitrary workspace IDs.
- [ ] Test role transitions and service-role isolation; commit `feat: add owner member administration`.

### Task 24: Add backend integration and performance tests

**Files:** Create `supabase/tests/functions.test.ts`, `supabase/tests/performance.sql`.

- [ ] Exercise all handlers through HTTP-like requests, verify no plaintext in audit rows, and verify RLS-denied rows cannot be decrypted.
- [ ] Seed 100,000 ciphertext metadata rows and assert keyset first-page, filtered-page, and summary plans use indexes and remain within the 3-second budget on local Supabase/Postgres.
- [ ] Commit `test: verify encrypted edge api and query budget`.

### Task 25: Add frontend Auth-only client boundary

**Files:** Create `frontend/src/lib/auth.ts`, `frontend/src/lib/cloud-api.ts`; create `frontend/tests/unit/cloud/cloud-api.test.ts`.

- [ ] Implement Auth session methods and Edge Function HTTP calls with bearer tokens, retry only idempotent reads, and map stable server error codes.
- [ ] Do not expose `.from`, SQL, PostgREST table names, or direct database query methods to the frontend.
- [ ] Test request headers, refresh behavior, generic errors, and no-query API surface; commit `feat: add authenticated edge api client`.

### Task 26: Add auth session state machine

**Files:** Modify `frontend/src/lib/auth.ts`; create `frontend/tests/unit/cloud/auth.test.ts`.

- [ ] Implement `loading`, `signed-out`, `signed-in`, `offline-authenticated`, and `error` states with explicit sign-in/sign-out/refresh transitions.
- [ ] Clear in-memory document data and encrypted local session handles on sign-out.
- [ ] Test login required, failed login, refresh, offline resume after prior login, and sign-out cleanup; commit `feat: manage authenticated client sessions`.

### Task 27: Add login screen using current UI primitives

**Files:** Create `frontend/src/components/auth/LoginPage.tsx`; modify `frontend/src/styles.css` only for existing token-compatible states; create `frontend/tests/component/auth/LoginPage.test.tsx`.

- [ ] Reuse current card, input, label, button, error, spacing, and typography components; do not redesign the application.
- [ ] Use standard labels `Email`, `Password`, `Sign in`, and `Sign out`; display generic auth errors without account enumeration.
- [ ] Test accessible labels, disabled submit state, failed login message, and successful callback; commit `feat: add required login screen`.

### Task 28: Add route AuthGate and workspace bootstrap

**Files:** Modify `frontend/src/routes/__root.tsx`, `frontend/src/router.tsx`; create `frontend/src/components/auth/AuthGate.tsx`; add tests under `frontend/tests/component/auth/`.

- [ ] Block application routes until AuthGate has a signed-in session and workspace context.
- [ ] Route signed-out users to login and preserve only safe post-login destinations.
- [ ] Test direct navigation while signed out, loading, signed in, and no-membership error; commit `feat: gate application routes by login`.

### Task 29: Add role capabilities and navigation gating

**Files:** Create `frontend/src/components/auth/RoleGate.tsx`; modify `frontend/src/components/AppLayout.tsx`; create `frontend/tests/component/auth/RoleGate.test.tsx`.

- [ ] Map server capabilities to existing navigation without changing current visual structure.
- [ ] Hide member/security controls from Administrator and Bookkeeper; preserve server enforcement for all actions.
- [ ] Test all three roles and inaccessible-route fallback; commit `feat: add role-aware application navigation`.

### Task 30: Add encrypted local-cache contracts

**Files:** Create `frontend/src/lib/local-cache.ts`, `frontend/tests/unit/sync/local-cache.test.ts`.

- [ ] Define `LocalCache`, `EncryptedRecord`, and `DeviceKeyProvider` interfaces with `get`, `put`, `remove`, `list`, and `clear` methods.
- [ ] Implement Web Crypto AES-GCM helpers for local records with a separate device key and versioned envelope.
- [ ] Test round trip, tamper rejection, key isolation, clear-on-sign-out, and no plaintext persistence; commit `feat: define encrypted offline cache`.

### Task 31: Add Electron OS-protected cache adapter

**Files:** Modify `frontend/src/electron/preload.cts`, `frontend/src/lib/electron-api.d.ts`, `frontend/src/electron/main/ipc.ts`, `frontend/src/electron/main/document-database.ts`; create integration tests under `frontend/tests/integration/electron-database/`.

- [ ] Add isolated IPC methods for encrypted cache blobs and device-key protection through Electron `safeStorage`; do not expose SQL or arbitrary file paths to the renderer.
- [ ] Store only encrypted payload envelopes in the local database and preserve explicit legacy import as a separate operation.
- [ ] Test IPC validation, database ciphertext-only rows, key retrieval failure, and migration safety; commit `feat: encrypt electron offline storage`.

### Task 32: Add browser IndexedDB cache adapter

**Files:** Modify `frontend/src/lib/local-cache.ts`; create `frontend/src/lib/browser-cache.ts` and `frontend/tests/unit/sync/browser-cache.test.ts`.

- [ ] Implement an IndexedDB adapter with object stores for cache, outbox, and device metadata; encrypt values before `put` and decrypt only after `get`.
- [ ] Bound record sizes and reject malformed storage envelopes.
- [ ] Test browser adapter behavior under clear, reopen, corruption, and sign-out; commit `feat: add encrypted browser cache`.

### Task 33: Add sync queue and single-flight semantics

**Files:** Create `frontend/src/lib/sync-engine.ts`, `frontend/tests/unit/sync/sync-engine.test.ts`.

- [ ] Define `SyncMutation`, `SyncConflict`, `SyncState`, and `SyncEngine` interfaces.
- [ ] Queue encrypted local mutations, submit one per workspace/device, persist stable mutation IDs, retry transient failures with bounded backoff, and stop on conflict/auth failure.
- [ ] Test ordering, duplicate retries, offline pause, reconnect resume, conflict pause, and sign-out clear; commit `feat: add offline sync engine`.

### Task 34: Add cloud document store adapter

**Files:** Create `frontend/src/lib/document-store.ts`; modify `frontend/src/lib/db.ts` only to retain shared document types or remove direct access; create `frontend/tests/unit/cloud/document-store.test.ts`.

- [ ] Implement `listPage`, `get`, `save`, `update`, `remove`, and `summary` through `cloud-api.ts` plus local cache fallback.
- [ ] Keep query parameters as API filters/cursors, never SQL; enforce maximum page size 250.
- [ ] Test online/offline paths, role capability rejection, cursor forwarding, and bounded responses; commit `feat: route documents through edge api store`.

### Task 35: Replace renderer document reads/writes

**Files:** Modify `frontend/src/components/DocumentEditor.tsx`, `frontend/src/components/DocumentEditorPage.tsx`, `frontend/src/components/DocList.tsx`, `frontend/src/routes/index.tsx`, `frontend/src/lib/document-editor-data.ts`.

- [ ] Replace all renderer imports of `saveDoc`, `getDoc`, `updateDoc`, `listDocs`, and `deleteDoc` with `document-store.ts` methods.
- [ ] Preserve existing editor fields, PDF behavior, list actions, and dashboard content while using API pagination/summary.
- [ ] Run focused component tests and commit `refactor: remove renderer database access`.

### Task 36: Add architecture guard against frontend queries

**Files:** Create `frontend/tests/architecture/no-frontend-database-query.test.ts`; modify test scripts if needed.

- [ ] Scan renderer source outside `src/electron` and fail on SQL keywords, `supabase.from`, PostgREST table access, direct database imports, or `electronApi().documents` calls.
- [ ] Assert approved access is limited to Auth and Edge Function client modules.
- [ ] Run the architecture test and commit `test: enforce queryless frontend boundary`.

### Task 37: Add keyset-paginated virtualized document lists

**Files:** Modify `frontend/src/components/DocList.tsx`; create `frontend/src/components/VirtualDocumentRows.tsx`; create component/performance tests.

- [ ] Use bounded pages and `nextCursor`, preserve the current table visual language, and virtualize rendered rows so 100,000 records never become 100,000 DOM nodes.
- [ ] Keep filtering/search server-side through API parameters and display loading/empty/error states using current components.
- [ ] Test cursor advancement, no duplicate rows, filters, and 100,000-record virtualization; commit `perf: virtualize paginated document lists`.

### Task 38: Add server-backed dashboard summaries

**Files:** Modify `frontend/src/routes/index.tsx`; modify `frontend/src/lib/document-store.ts`; add `frontend/tests/component/routes/Dashboard.test.tsx`.

- [ ] Replace full-document dashboard loading with the `summary` endpoint for counts and month buckets.
- [ ] Keep existing chart/card layout and labels; do not fabricate values when the server returns no data.
- [ ] Test summary rendering, empty state, stale cache, and role-restricted data; commit `perf: use server dashboard aggregates`.

### Task 39: Add sync status and conflict UI

**Files:** Create `frontend/src/components/sync/SyncStatus.tsx`, `frontend/src/components/sync/ConflictDialog.tsx`; modify `frontend/src/components/AppLayout.tsx`, `frontend/src/components/DocumentEditor.tsx`; add component tests.

- [ ] Reuse current badges, dialogs, buttons, and spacing for `Synced`, `Offline`, `Syncing`, `Needs attention`, and conflict resolution.
- [ ] Show local/server revision and field-level comparison without sending conflict data to logs; require explicit Keep local/Use server action.
- [ ] Test keyboard accessibility, conflict retry, cancellation, and sign-out cleanup; commit `feat: add visible sync and conflict states`.

### Task 40: Add explicit legacy SQLite migration to cloud

**Files:** Modify `frontend/src/electron/main/ipc.ts`, `frontend/src/electron/main/document-database.ts`, `frontend/src/components/` migration UI, and `frontend/src/lib/document-store.ts`; add migration tests.

- [ ] Allow only an authenticated Owner or Administrator to start migration.
- [ ] Validate each legacy row, upload through the Edge Function one at a time with mutation IDs, retain failed rows, and require user confirmation before local deletion.
- [ ] Never log document values or upload raw SQLite rows; test partial failure, retry, cancellation, and duplicate prevention; commit `feat: migrate legacy documents through encryption api`.

### Task 41: Add immutable-migration CI and performance workflow

**Files:** Create `.github/workflows/ci.yml`; modify root scripts/package metadata as needed.

- [ ] Run migration immutability verification, frontend architecture checks, `npm test`, `npm run lint`, `npm run build`, `npm run build:electron`, SQL/RLS tests, and the 100,000-row benchmark.
- [ ] Upload sanitized benchmark/test diagnostics without document payloads; keep all quality gates blocking.
- [ ] Ensure SQL files changed in a PR are rejected unless they are newly appended migrations.
- [ ] Commit `ci: enforce security and performance quality gates`.

### Task 42: Complete security review, documentation, and final verification

**Files:** Modify `frontend/README.md`, root `README.md`; create `docs/superpowers/reviews/2026-09-27-authenticated-encrypted-cloud-sync-review.md`.

- [ ] Document Supabase secrets, manual Owner/workspace bootstrap, deployment commands, key versioning, role matrix, offline behavior, migration immutability, and Android API contract.
- [ ] Review for service-role leakage, plaintext logs, plaintext Postgres fields, direct frontend queries, RLS gaps, unbounded queries, and stale migration edits.
- [ ] Run the complete local gate from `frontend/`: `npm test`, `npm run lint`, `npm run build`, and `npm run build:electron`; run Supabase SQL/function/performance gates.
- [ ] Record exact fresh command output and any unavailable remote checks; commit `docs: finalize encrypted sync security review`.

## Plan Self-Review

- Spec coverage: authentication, three roles, manual Owner provisioning, AES-256-GCM, ciphertext-only Postgres, strict RLS, Edge Functions, web/Electron/Android-compatible API, offline cache/outbox, conflicts, migration, logging, key versioning, performance, and verification each have explicit tasks.
- Placeholder scan: the plan contains no unresolved placeholder or deferred implementation task. Root script placement is resolved by the exact verifier behavior in Task 3; no feature depends on an unspecified choice.
- Type consistency: backend `document_kind`, `app_role`, revision, mutation ID, and key-version names are reused in Edge Functions and frontend cloud types. The frontend store calls bounded keyset APIs and never calls a database client.
- Migration immutability: migrations use the required sequence/date/time/purpose filename, each task ends with a commit, and Task 3/41 reject modifications to existing SQL files.
- Performance: indexed keyset reads, server summaries, bounded pages, virtualized rows, seeded 100,000-row benchmarks, and blocking CI are all included without external infrastructure.
- Existing behavior: current UI primitives, routes, PDF generation, Electron isolation, and legacy data import are preserved or explicitly adapted through the cloud migration path.
