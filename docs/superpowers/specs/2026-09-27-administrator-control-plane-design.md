# Administrator Control Plane Design

## Context

TDA Car Rental needs a secure, browser/Electron/mobile-compatible administration area for authenticated workspace operators. Owners and Administrators need operational visibility and account-management tools, while Bookkeepers must remain outside the administration surface. The feature must preserve the current application UI, use Supabase Edge Functions rather than direct frontend database queries, and remain performant for workspaces containing up to 100,000 records.

## Goals

- Give Owners and Administrators a clear, role-gated administration area.
- Provide these tabs to both roles:
  - Admin Dashboard
  - API Documentation
  - User Management
- Provide one additional Owner-only tab:
  - Workspace Settings
- Enforce access at the route, Edge Function, and database/RLS boundaries.
- Keep sensitive document contents out of frontend query paths and PostgreSQL plaintext.
- Keep list operations bounded through server-side filtering, ordering, and cursor pagination.
- Preserve the current TDA Car Rental visual language and responsive behavior.

## Non-goals

- MFA, which remains outside this MVP.
- A public API documentation portal.
- Exposing service-role credentials, internal encryption keys, or unrestricted SQL capabilities through the API documentation.
- Loading all workspace users or documents into the browser.
- A separate visual theme or a second application shell for administration.

## Visual direction

### Context sentence

This is a dense operational control plane for authenticated workspace operators who need to inspect status, manage accounts, and understand supported API operations quickly.

### Aesthetic anchor

Use a restrained Swiss-style extension of the existing UI. The current product already uses a neutral shadcn/Tailwind system with concise labels, cards, tables, and restrained color. A Swiss anchor adds stronger grid alignment, compact hierarchy, and precise active states without disrupting the existing billing, quotation, receipt, and contract workflows.

### Visible differentiator

The administration area will have a compact control-plane header containing the workspace context, the signed-in role, and a deliberate tab strip. The tab strip will use a clear active indicator and hairline separators so operators can understand their location without adding a new navigation paradigm.

### UI rules

- Reuse the existing color tokens, typography, buttons, cards, tables, dialogs, and responsive breakpoints.
- Use real labels: `Admin Dashboard`, `API Documentation`, `User Management`, and `Workspace Settings`.
- Use Lucide icons already used by the application; do not use text glyphs as icon substitutes.
- Do not add fabricated metrics, sample users, or placeholder API records. Empty states must explain the actual next action.
- Keep the admin tab strip usable at narrow widths with horizontal scrolling or a compact responsive treatment.

## Information architecture

### Routes

- `/admin` — Admin Dashboard.
- `/admin/api-docs` — Swagger-style API Documentation.
- `/admin/users` — User Management.
- `/admin/settings` — Workspace Settings; Owner-only.

The admin layout will own the tab navigation and will remain nested under the existing authenticated application shell. Each tab has a stable deep link. The generated TanStack Router route tree must be regenerated through the project tooling rather than edited manually.

### Visibility and access matrix

| Capability | Owner | Administrator | Bookkeeper |
| --- | --- | --- | --- |
| See Admin Dashboard tab | Yes | Yes | No |
| Open Admin Dashboard route | Yes | Yes | No |
| See API Documentation tab | Yes | Yes | No |
| Open API Documentation route | Yes | Yes | No |
| See User Management tab | Yes | Yes | No |
| Open User Management route | Yes | Yes | No |
| See Workspace Settings tab | Yes | No | No |
| Open Workspace Settings route | Yes | No | No |

The UI must hide unavailable tabs, but hiding is not the security boundary. Every route loader/page and every relevant Edge Function must re-check the authenticated user and workspace role. A denied direct URL must render the application’s existing authorization/error treatment or redirect to an allowed admin route without leaking protected data.

## Admin Dashboard

The first version should be a metadata-only operational overview. It may show workspace context, the current role, access state, and bounded aggregate summaries returned by Edge Functions. It must not fetch or decrypt full billing, quotation, contract, or receipt contents merely to render the dashboard.

Dashboard requests must return a fixed-size response regardless of workspace size. Any future counts or aggregates must be computed server-side with indexed predicates and bounded queries; the frontend must never scan 100,000 records.

## API Documentation

The API Documentation tab will be a read-only, Swagger-style reference for the supported client-facing Edge Function contract. It should include:

- Function/operation name.
- HTTP method and path.
- Authentication requirement.
- Required workspace context.
- Request parameters/body shape.
- Success response shape.
- Expected authorization and validation errors.
- Encryption behavior at a high level where relevant, without displaying keys or ciphertext secrets.

The documentation must be sourced from a versioned OpenAPI-like definition in the repository or a server-provided safe contract. It must not introspect the database from the browser, execute arbitrary operations, or expose service-role-only functions. Examples must be schema examples, not fabricated business records.

## User Management

User Management is an operator UI for workspace accounts, backed exclusively by Edge Functions.

### Operations

- Create: invite a user by email and assign an allowed workspace role.
- Read: search and list workspace members with server-side filters and cursor pagination.
- Update: change an eligible member’s role or active status, subject to role policy.
- Delete: use audit-preserving deactivation/archival in the MVP rather than hard-deleting the Auth account. The UI should label this action `Deactivate`, with `Reactivate` available where permitted.

The existing member-management function already covers invite, role change, deactivation, and reactivation. The implementation should extend or normalize that contract rather than create a second competing authorization path. It must preserve protections against self-deactivation and self-role changes unless a later explicit requirement changes that policy.

### Performance contract

- Default page size is bounded and capped server-side.
- Use keyset/cursor pagination for member lists; do not rely on large offsets for deep pages.
- Search/filter/order parameters are validated against an allowlist.
- Responses contain only the fields needed by the table and action controls.
- Mutations return the changed member summary, not an unbounded refreshed collection.
- The frontend must not issue direct Supabase queries or request all members.

### Role policy

- Owners can manage workspace members and assign Administrator or Bookkeeper roles.
- Administrators can manage workspace members according to the existing backend policy, but cannot create another Owner, change Owner membership, or access Workspace Settings.
- Bookkeepers cannot access this surface.
- Self-role changes and self-deactivation remain disallowed for the MVP.

The exact distinction between Owner and Administrator mutation powers must remain enforced in the Edge Function, independent of frontend controls.

## Workspace Settings

Workspace Settings is visible and routable only for Owners. The MVP should establish the owner-only surface without inventing settings that are not yet backed by a safe API. It may initially contain workspace identity and security/status information that can be returned without exposing secrets. Future settings such as workspace policy, encryption-key rotation metadata, and billing/subscription controls should be added as explicit, audited operations.

No encryption key, service-role key, database URL, or secret environment value may be returned to this page or stored in frontend state.

## Backend and security boundaries

- Browser, Electron, and future Android clients use the same authenticated Edge Function contract.
- Every function validates the Supabase access token, resolves the requested workspace, and checks membership/role before performing work.
- `x-workspace-id` is treated as a selector only; it never grants access by itself.
- RLS remains enabled and restrictive. Service-role usage is limited to narrowly scoped server-side operations that require it, with explicit authorization performed before the service-role call.
- Billing and quotation payloads remain AES-256-GCM encrypted at rest. Admin features must operate on metadata or decrypted data only inside authorized server-side execution paths.
- CORS preflight handling must continue to allow the client’s authenticated headers, including `x-workspace-id`, without bypassing function authorization.
- Errors returned to clients must be safe and non-enumerating; detailed operational failures belong in server logs/audit records.

Any database change must use a new immutable migration whose filename follows the project convention:

`number_date-of-creation(mmddyyyy-time)_purpose.sql`

Existing SQL migration files must never be edited after creation.

## Verification expectations

- Route visibility and direct URL denial are tested for all three roles.
- Edge Function authorization is tested independently of the UI.
- Member list tests prove bounded pagination and validated filters.
- API documentation tests ensure secrets and service-role operations are absent.
- Existing frontend lint/typecheck/build/test gates remain enabled.
- Hosted CORS/auth behavior is verified when deployment credentials are available.

## Open implementation decision

The design uses deactivation as the safe MVP interpretation of `Delete` for user management. Permanent deletion of a Supabase Auth account is intentionally excluded unless explicitly requested later, because it can destroy auditability and create irreversible workspace history changes.
