# Authenticated Encrypted Cloud Sync Design

Date: 2026-09-27

## Goal

Allow TDA Car Rental users to sign in from a normal web browser, the Electron desktop app, and future Android clients, while synchronizing billing and quotation data through Supabase. The first release uses email/password authentication, requires login before application access, supports offline work after a device has authenticated successfully, and defines three roles: Owner, Administrator, and Bookkeeper.

The first Owner account is created manually in Supabase. There is no public signup or anonymous mode in the MVP. MFA is intentionally out of scope for the MVP.

## Decisions

### Encryption boundary

Supabase Edge Functions are the encryption boundary. The document encryption key is a 32-byte secret stored in Edge Function secrets and is never stored in Postgres or returned to clients. Functions encrypt and decrypt only in memory using AES-256-GCM with a fresh random 12-byte IV per write. The authentication tag is retained as part of the authenticated ciphertext produced by AES-GCM.

Billing, quotation, and acknowledgement business fields are encrypted as one versioned JSON payload. This includes names, dates, totals, line items, payment details, notes, and other document fields. Postgres may retain only minimal non-sensitive metadata needed for tenancy, authorization, indexing, and synchronization: UUID, workspace ID, document kind, revision, key version, mutation ID, timestamps, and deletion state. Contracts remain in the existing local/PDF flow and are not included in cloud document synchronization in this scope.

The Edge Functions receive plaintext over TLS for an authorized operation, but never write document plaintext to Postgres, audit events, logs, error responses, or analytics. Operational logging must redact request bodies and document identifiers where they could reveal sensitive information.

### Authentication and authorization

Supabase Auth provides email/password sessions. The client displays a login screen whenever there is no valid authenticated session. Route visibility is role-aware, but UI checks are not security boundaries; every Edge Function and every Postgres policy repeats authorization.

The tenant model consists of workspaces and active workspace memberships. Each membership has exactly one fixed role:

- Owner: full access, including member invitations, role assignment, and workspace/security settings.
- Administrator: manage and synchronize all business documents, but cannot change Owner or security settings.
- Bookkeeper: create, read, update, and delete billing, quotation, and acknowledgement records; read-only access to contracts; no user or security administration.

The service-role key is used only inside tightly scoped member-administration functions. It is never shipped to clients and never used for normal document CRUD.

### RLS boundary

RLS is enabled and forced on every exposed application table. Document policies require an active membership in the same workspace and enforce document-kind permissions for each role. The Edge Function document client forwards the caller's JWT when accessing Postgres, so `auth.uid()` and RLS remain effective inside the function.

Membership helper functions are `SECURITY DEFINER` only where needed, set a fixed `search_path`, use schema-qualified references, and have restricted `EXECUTE` grants. Tables receive least-privilege grants for the `authenticated` role. Cross-workspace access, inactive-member access, anonymous access, and direct client attempts to bypass the Edge Function are denied. Database constraints enforce valid roles and document kinds, active-membership uniqueness, positive revisions, and idempotent client mutation IDs.

This is defense in depth, not a claim that any system is impossible to hack: an exposed database contains ciphertext, RLS blocks unauthorized rows, and the service role is isolated from document operations.

## Components and data flow

### Supabase schema

- `workspaces`: tenant boundary and owner metadata.
- `workspace_members`: workspace/user membership, role, active status, and timestamps.
- `documents`: UUID, workspace ID, document kind, encrypted IV, encrypted payload, key version, revision, client mutation ID, audit timestamps, and soft-delete marker. No business fields are stored as plaintext columns.
- `audit_events`: actor, workspace, action, document ID, result, and timestamp only; never document contents.
- `sync_devices` or equivalent cursor state: per-user/device synchronization state without document payloads.

### Edge Functions

The initial function surface is versioned and narrow:

- authentication/session bootstrap and workspace context;
- document list/get/create/update/delete and synchronization;
- member invitation, deactivation, and role management;
- health and key-version metadata without returning secrets.

Document functions validate the bearer token, parse the request with an allowlist schema, resolve the caller's active membership, apply role/document-kind checks, encrypt or decrypt in memory, and use the caller-scoped Supabase client for the database operation. Member-management functions may use the service role only after checking Owner authority and must not share that client with document code.

### Client applications

Web and Electron share the same authentication, API, payload, and sync contracts. Android can implement the same contracts later without changing the database or authorization model. The Electron main process retains the OS-native file/PDF responsibilities; sensitive cloud cache and outbox access is exposed to the renderer only through the existing isolated preload bridge.

## Offline and synchronization behavior

Offline use is permitted only after a successful login on that device. The local cache and outbox are encrypted with a device-local key protected by Electron OS storage or platform Web Crypto/keystore facilities. Synced document fields are never written as plaintext to SQLite, IndexedDB, logs, or analytics.

The client submits mutations through a single-flight queue per device/workspace. Each mutation has a stable client mutation ID so retries are idempotent. The server applies an expected-revision check. A stale revision returns a conflict with the authorized server version; it never silently overwrites another user's edit. The UI presents the local and server versions and requires an explicit resolution before retrying. The server is authoritative after successful sync, while rejected mutations stay encrypted in the outbox for retry or user resolution.

An offline cached session does not create an unauthenticated mode: first-time access still requires login, and the client must not expose a workspace that was never successfully authenticated on that device.

## Error handling and key rotation

Client errors use stable generic codes such as `UNAUTHENTICATED`, `FORBIDDEN`, `CONFLICT`, `VALIDATION_FAILED`, and `SYNC_RETRYABLE`. They do not contain SQL errors, key material, decrypted payloads, or membership details that reveal other users. Audit and operational logs contain only sanitized metadata.

Encrypted rows carry a key version. A future rotation can decrypt using an explicitly allowlisted previous key version and re-encrypt with the active key during a controlled migration. No key is accepted from a client request, and key rotation is not implemented by changing the stored ciphertext without authenticated decryption/re-encryption.

## Migration from the current app

The current Electron SQLite store is plaintext and local-first. Cloud sync must not upload those rows directly. A logged-in Owner or Administrator will initiate an explicit import: each selected billing/quotation/acknowledgement row is validated, encrypted by the Edge Function, uploaded with a mutation ID, and marked as migrated only after server confirmation. Failed rows remain local and are reported without exposing their contents in logs. The old local rows are not deleted automatically until successful migration and user confirmation.

## Verification plan

Local and CI-equivalent checks will include:

- AES-256-GCM round trips, tamper detection, IV uniqueness, key-version handling, and rejection of malformed payloads;
- role decision tests, revision conflicts, mutation idempotency, and sanitized error behavior;
- Supabase SQL/RLS tests for Owner, Administrator, Bookkeeper, inactive member, cross-workspace, anonymous, and service-role scenarios;
- Edge Function tests proving unauthorized callers cannot receive decrypted data and that plaintext never enters audit events;
- component tests for login guards, role-based navigation, offline queueing, conflict resolution, and sign-out cleanup;
- all existing Electron, database, migration, PDF, component, and route tests;
- `npm test`, `npm run lint`, `npm run build`, and `npm run build:electron` from `frontend/`.

No GitHub Actions workflow exists in the repository currently, so these local checks are the available completion gates. Existing tests and quality gates must remain enabled.

## Out of scope for the MVP

- MFA;
- public signup and self-service workspace creation;
- client-side zero-knowledge encryption;
- cloud synchronization of contracts/PDF files;
- automatic conflict merging;
- production key rotation execution and disaster-recovery procedures beyond versioned storage hooks.
