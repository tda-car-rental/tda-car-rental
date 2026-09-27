# TDA Car Rental

The repository root contains the Supabase project, shared documentation, and the `frontend/` application.

## Application development

```sh
cd frontend
npm install
npm run dev
```

Run the frontend quality gates from `frontend/`:

```sh
npm test
npm run lint
npm run build
npm run build:electron
```

Supabase migrations and Edge Functions live under `supabase/`. Migration files are immutable and must use:

```text
NNNNNN_MMDDYYYY-HHmm_purpose.sql
```

The timestamp is the creation time in Asia/Manila using 24-hour `HHmm`. Corrections are always new migrations with a higher sequence number.
