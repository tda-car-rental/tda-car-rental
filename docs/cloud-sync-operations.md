# Cloud sync operations

The web renderer never queries Supabase or the Electron document database. It calls the Edge Functions with the Supabase access token. Postgres stores only ciphertext and authorization/synchronization metadata.

## Required configuration

Set these Edge Function secrets in Supabase:

- `DOCUMENT_ENCRYPTION_KEY`: base64 for a randomly generated 32-byte key.
- `DOCUMENT_ENCRYPTION_KEY_VERSION`: `1` for the initial key.
- `ALLOWED_ORIGINS`: comma-separated production web origins.
- `SUPABASE_SERVICE_ROLE_KEY`: used only by the `members` function for invitation email administration.

Set these public frontend variables at build time:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or the current `VITE_SUPABASE_PUBLISHABLE_KEY`

The frontend Vite configuration loads the repository-root `.env` file for local
development. Keep that file untracked; production deployments must provide the
same public variables through their build environment.

Never commit any of these values. Rotate the document key through a versioned key-rotation procedure; do not overwrite an existing migration or reinterpret ciphertext with a new key.

## First Owner bootstrap

1. Create the first email/password user manually in Supabase Auth.
2. Copy that user UUID into the SQL Editor and run an explicit workspace/member insert using the authenticated SQL session:

```sql
insert into public.workspaces (name, created_by)
values ('TDA Car Rental Services', '<auth-user-uuid>')
returning id;

insert into public.workspace_members (workspace_id, user_id, role, active)
values ('<returned-workspace-uuid>', '<auth-user-uuid>', 'owner', true);
```

The Owner role is not assignable through the member Edge Function. Subsequent users may be invited only as Administrator or Bookkeeper.

## Migration immutability

Migration files under `supabase/migrations/` are append-only. They must use `NNNNNN_MMDDYYYY-HHmm_purpose.sql`, with the timestamp in Asia/Manila. Once committed, a SQL file must never be edited. Corrections are new migrations with a higher sequence number. Run `node scripts/verify-supabase-migrations.mjs` before committing database changes.

## Performance boundary

Document reads use indexed `(workspace_id, document_kind, updated_at, id)` keyset pagination with a maximum page size of 250. The renderer virtualizes visible rows. Summary counts use metadata-only indexed count queries; sensitive totals are not stored as plaintext aggregates.
