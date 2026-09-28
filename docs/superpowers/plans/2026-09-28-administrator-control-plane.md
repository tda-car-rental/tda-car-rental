# Administrator Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure Owner/Administrator control plane with Admin Dashboard, API Documentation, User Management, and Owner-only Workspace Settings across the web and Electron clients.

**Architecture:** Keep the existing authenticated TanStack Router application shell and add a reusable admin shell with role-filtered tabs. All member reads and mutations go through the Supabase `members` Edge Function; the browser never queries Supabase tables directly. The Edge Function verifies the caller with the user JWT, verifies active workspace membership and role, then uses a narrowly scoped service-role dependency for Auth administration and bounded member reads/writes.

**Tech Stack:** React 19, TanStack Router, TypeScript, Tailwind CSS v4, Lucide React, Vitest, Supabase Edge Functions, PostgreSQL/RLS, Node test runner for Edge Functions.

## Global Constraints

- Owners and Administrators can access `Admin Dashboard`, `API Documentation`, and `User Management`.
- Only Owners can access `Workspace Settings`.
- Bookkeepers must not see or open the admin routes.
- The frontend must not query Supabase/PostgreSQL directly; use `frontend/src/lib/cloud-api.ts` and Edge Functions.
- Member lists must use bounded server-side pagination and validated filters; never load 100,000 records into the browser.
- Billing and quotation contents remain AES-256-GCM encrypted at rest and are not loaded for admin metadata screens.
- Every admin route and Edge Function operation must enforce authentication, workspace membership, and role authorization independently of navigation visibility.
- Existing SQL migration files are immutable. The new migration must use `NNNNNN_MMDDYYYY-HHmm_purpose.sql`, using Asia/Manila time, and must never be edited after creation.
- Preserve existing CI gates: frontend lint, frontend Vitest, frontend production build, migration verification, and Edge Function tests.
- Do not add MFA in this MVP.

## File map

| File | Responsibility |
| --- | --- |
| `supabase/functions/_shared/roles.ts` | Central role/capability policy for admin access and member management. |
| `supabase/functions/workspace-context/handler.ts` | Return the frontend-safe admin capabilities in workspace context. |
| `supabase/functions/members/handler.ts` | Authenticate, authorize, paginate, invite, update, deactivate, and reactivate workspace members. |
| `supabase/functions/members/handler.test.ts` | Authorization, validation, pagination, and mutation contract tests. |
| `supabase/migrations/000009_09282026-2001_administrator_member_access.sql` | Append-only schema/index/RLS correction for administrator member management. |
| `supabase/tests/rls.sql` | SQL assertions for self visibility, admin member management, and bookkeeper denial. |
| `frontend/src/lib/cloud-types.ts` | Shared member, cursor, capability, and page response types. |
| `frontend/src/lib/cloud-api.ts` | Typed Edge Function client methods for member reads and mutations. |
| `frontend/tests/unit/cloud/cloud-api.test.ts` | Request path, headers, query, and mutation serialization tests. |
| `frontend/src/components/AppLayout.tsx` | Existing navigation plus role-filtered entry point to the admin area. |
| `frontend/src/components/admin/AdminLayout.tsx` | Reusable admin shell, Swiss-style tab strip, and role-aware tab visibility. |
| `frontend/src/components/admin/AdminAccessGuard.tsx` | Direct-route role protection with a safe denied state. |
| `frontend/src/components/admin/AdminDashboard.tsx` | Metadata-only admin overview. |
| `frontend/src/components/admin/ApiDocumentation.tsx` | Read-only Swagger-style operation reference. |
| `frontend/src/components/admin/UserManagement.tsx` | Paginated member table, invite form, role/status actions, and safe empty/error states. |
| `frontend/src/components/admin/WorkspaceSettings.tsx` | Owner-only workspace identity and security/status view. |
| `frontend/src/lib/api-docs.ts` | Versioned, safe OpenAPI-like documentation definition with no secrets or fabricated records. |
| `frontend/src/routes/admin.tsx` | `/admin` Admin Dashboard route. |
| `frontend/src/routes/admin.api-docs.tsx` | `/admin/api-docs` route. |
| `frontend/src/routes/admin.users.tsx` | `/admin/users` route. |
| `frontend/src/routes/admin.settings.tsx` | `/admin/settings` Owner-only route. |
| `frontend/tests/component/admin/AdminLayout.test.tsx` | Admin tab visibility and role behavior. |
| `frontend/tests/component/admin/UserManagement.test.tsx` | Pagination, invite, role, and status UI behavior. |
| `frontend/tests/architecture/frontend-data-boundary.test.ts` | Extend the boundary guard to keep admin data off direct Supabase/table paths. |
| `frontend/src/routeTree.gen.ts` | Generated route output; regenerate with the project build, never hand-edit. |

---

### Task 1: Lock the role and workspace-context contract with tests

**Files:**
- Modify: `supabase/functions/_shared/roles.ts`
- Modify: `supabase/functions/workspace-context/handler.ts`
- Modify: `supabase/functions/workspace-context/handler.test.ts`
- Create: `supabase/functions/_shared/roles.test.ts`
- Modify: `frontend/src/lib/cloud-types.ts`

**Interfaces:**
- Produce `canAccessAdmin(role: CloudRole): boolean`, `canManageMembers(role: CloudRole): boolean`, and `canManageWorkspaceSettings(role: CloudRole): boolean`.
- Produce workspace capabilities `canAccessAdmin` and `canManageWorkspaceSettings` alongside the existing capability fields.

- [ ] **Step 1: Write failing role-policy tests.** Assert that Owner and Administrator access the admin surface, Bookkeeper does not, Owner and Administrator can manage members, and only Owner can manage workspace settings.
- [ ] **Step 2: Run the focused Edge Function test.** Run `node --experimental-strip-types --test supabase/functions/_shared/roles.test.ts supabase/functions/workspace-context/handler.test.ts`. Confirm the new assertions fail before implementation.
- [ ] **Step 3: Implement the centralized role predicates.** Keep all role comparisons in `roles.ts`; do not duplicate role strings in handlers.
- [ ] **Step 4: Update workspace context.** Return the two new capability booleans without returning user records, tokens, or secrets.
- [ ] **Step 5: Update TypeScript cloud types and handler expectations.** Preserve existing capability fields for backwards compatibility.
- [ ] **Step 6: Run the focused tests again.** Expected: all role and workspace-context tests pass.
- [ ] **Step 7: Commit.** Run `git add supabase/functions/_shared/roles.ts supabase/functions/_shared/roles.test.ts supabase/functions/workspace-context/handler.ts supabase/functions/workspace-context/handler.test.ts frontend/src/lib/cloud-types.ts` and commit `feat: define administrator control-plane roles`.

### Task 2: Add the immutable member-management migration and RLS correction

**Files:**
- Create: `supabase/migrations/000009_09282026-1951_administrator_member_access.sql`
- Modify: `supabase/tests/rls.sql`
- Modify: `supabase/tests/performance.sql` only if the new member index needs a measured query assertion

**Interfaces:**
- Add nullable `workspace_members.email` for invitation/member-list summaries; existing rows remain valid with `NULL` until an account is invited or synchronized.
- Add a workspace/time/user index for descending keyset pagination.
- Change the database policy helper so Owners and Administrators can manage member rows while Bookkeepers cannot.

- [ ] **Step 1: Write the SQL RLS assertions.** Add checks that an active member can still read their own membership for workspace-context resolution, an Owner/Administrator can manage member rows through the intended policy, and a Bookkeeper cannot read other membership rows or mutate membership rows.
- [ ] **Step 2: Add the one new migration.** Use `alter table` for `email`, add a check that accepts `NULL` or a trimmed email length from 3 through 320, add the `(workspace_id, active, created_at desc, user_id desc)` index, replace the existing member-management helper/policies in this migration, and grant only the required authenticated privileges. Do not edit migrations `000001` through `000008`.
- [ ] **Step 3: Verify immutability and filename.** Run `node scripts/verify-supabase-migrations.mjs`. Expected: the migration checker accepts the new filename and reports no edited historical migration.
- [ ] **Step 4: Run SQL fixture checks where a local Supabase/PostgreSQL runner is available.** Expected: RLS assertions pass; otherwise record the local environment limitation without weakening the CI gate.
- [ ] **Step 5: Commit.** Commit `feat: authorize administrator member management` with only the new migration and SQL tests.

### Task 3: Expand the members Edge Function into a bounded admin API

**Files:**
- Modify: `supabase/functions/members/handler.ts`
- Modify: `supabase/functions/members/index.ts` only if the injected service-role database client needs wiring
- Modify: `supabase/functions/members/handler.test.ts`
- Modify: `supabase/functions/_shared/http.ts` only if a narrowly validated query helper is needed

**Interfaces:**
- `GET /members?limit=50&cursor=<base64>&search=<email-prefix>` returns `{ members: CloudMemberSummary[], nextCursor: string | null }`.
- `POST /members` accepts `{ operation: "invite", email: string, role: "administrator" | "bookkeeper" }`, `{ operation: "set-role", userId: string, role: ... }`, `{ operation: "deactivate", userId: string }`, or `{ operation: "reactivate", userId: string }`.
- `CloudMemberSummary` fields are `userId`, `email`, `role`, `active`, `createdAt`, and `updatedAt`.

- [ ] **Step 1: Add failing handler tests.** Cover Owner and Administrator list access, Bookkeeper `403`, missing/invalid workspace, limit caps, malformed cursor, prefix search validation, Owner/Administrator invite, forbidden Owner assignment, self-role/self-deactivation rejection, and safe error bodies.
- [ ] **Step 2: Run the focused tests.** Run `node --experimental-strip-types --test supabase/functions/members/handler.test.ts`. Confirm new cases fail against the current POST-only owner-only handler.
- [ ] **Step 3: Add strict request parsing.** Accept only `GET` and `POST`, cap `limit` at 100, validate UUID-like user IDs, validate lowercase email length/format, allow only `administrator` and `bookkeeper` assignment, and reject unknown query keys only where they could alter authorization.
- [ ] **Step 4: Implement keyset pagination.** Sort by `created_at desc, user_id desc`; decode a cursor containing `{ createdAt, userId }`; apply a stable “older than cursor” predicate; fetch `limit + 1`; return at most `limit` summaries and an opaque next cursor.
- [ ] **Step 5: Separate caller authorization from privileged operations.** Resolve the caller through `requireUser` and `requireWorkspaceMember` using the caller JWT. After `canManageMembers`, use the injected service-role database/Auth dependencies for bounded member summaries and Auth invitations, never before authorization.
- [ ] **Step 6: Preserve audit-safe deletion semantics.** Keep deactivation/reactivation as status changes; reject self-deactivation and self-role changes; never hard-delete an Auth user in this MVP.
- [ ] **Step 7: Run focused tests and the full Edge Function suite.** Expected: members tests pass and `node --experimental-strip-types --test supabase/functions/**/*.test.ts` remains green.
- [ ] **Step 8: Commit.** Commit `feat: add paginated administrator members api`.

### Task 4: Add typed frontend cloud methods without direct queries

**Files:**
- Modify: `frontend/src/lib/cloud-types.ts`
- Modify: `frontend/src/lib/cloud-api.ts`
- Modify: `frontend/tests/unit/cloud/cloud-api.test.ts`
- Modify: `frontend/tests/architecture/frontend-data-boundary.test.ts` if the boundary test needs the new endpoint allowlist

**Interfaces:**
- `MemberCursor = { createdAt: string; userId: string }`.
- `CloudMemberSummary = { userId: string; email: string | null; role: CloudRole; active: boolean; createdAt: string; updatedAt: string }`.
- `MemberPage = { members: CloudMemberSummary[]; nextCursor: string | null }`.
- `listMembers({ workspaceId, limit?, cursor?, search? }): Promise<MemberPage>`.
- `inviteMember(workspaceId, input): Promise<{ memberId: string }>`.
- `setMemberRole(workspaceId, userId, role): Promise<{ ok: true }>`.
- `setMemberStatus(workspaceId, userId, active): Promise<{ ok: true }>`.

- [ ] **Step 1: Add failing request tests.** Assert `GET members` includes the access token and `x-workspace-id`, caps are sent from the caller, cursors are encoded, and POST bodies contain no extra fields.
- [ ] **Step 2: Implement the types and methods.** Reuse the existing `request` function so all calls retain auth, JSON, CORS-compatible headers, and safe `CloudApiError` handling.
- [ ] **Step 3: Run the focused frontend cloud test.** Run `npm.cmd --prefix frontend run test -- tests/unit/cloud/cloud-api.test.ts`. Expected: pass without any `.from`, `.rpc`, or direct Supabase query in frontend code.
- [ ] **Step 4: Commit.** Commit `feat: expose typed member cloud api`.

### Task 5: Build the admin shell, direct-route guard, and application navigation

**Files:**
- Create: `frontend/src/components/admin/AdminAccessGuard.tsx`
- Create: `frontend/src/components/admin/AdminLayout.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`
- Create: `frontend/tests/component/admin/AdminLayout.test.tsx`

**Interfaces:**
- `AdminAccessGuard({ requiredRole?: "owner" | "administrator" | "bookkeeper", children })` renders children only when the workspace context permits the requested surface; otherwise it renders a safe access-denied state with a link to `/`.
- `AdminLayout({ title, children })` renders the existing `AppLayout` plus the admin tab strip and role/workspace context.

- [ ] **Step 1: Write failing component tests.** Render Owners, Administrators, and Bookkeepers through `WorkspaceContextProvider`; assert tab visibility, Owner-only Settings, and denied direct-route content.
- [ ] **Step 2: Implement `AdminAccessGuard`.** Check the context role before rendering any page-specific data component; do not fetch data for denied users.
- [ ] **Step 3: Implement the Swiss-style admin shell.** Reuse current tokens/components, use hairline borders and left-aligned hierarchy, and use Lucide icons. Keep labels exactly `Admin Dashboard`, `API Documentation`, `User Management`, and `Workspace Settings`.
- [ ] **Step 4: Add the main sidebar Admin entry point.** Show it only for Owner/Administrator and preserve all existing product navigation.
- [ ] **Step 5: Run focused component tests.** Expected: Owner and Administrator see three shared tabs, Owner sees Settings, Bookkeeper sees none and receives no admin content.
- [ ] **Step 6: Commit.** Commit `feat: add role-aware admin navigation`.

### Task 6: Add Admin Dashboard and Owner-only Workspace Settings routes

**Files:**
- Create: `frontend/src/routes/admin.tsx`
- Create: `frontend/src/routes/admin.settings.tsx`
- Create: `frontend/src/components/admin/AdminDashboard.tsx`
- Create: `frontend/src/components/admin/WorkspaceSettings.tsx`

**Interfaces:**
- `/admin` renders a metadata-only dashboard using workspace context and the existing bounded summary Edge Function if summary cards are shown.
- `/admin/settings` renders only Owner-safe workspace identity and status fields from workspace context; it never returns or displays secrets.

- [ ] **Step 1: Write route/component tests.** Assert the dashboard contains workspace/role information and that Settings is denied for Administrator and Bookkeeper before any settings data is requested.
- [ ] **Step 2: Implement the dashboard.** Use real workspace context labels and bounded summary data only; never call `listDocs()` or load full encrypted document payloads.
- [ ] **Step 3: Implement Workspace Settings.** Present the workspace name, current role, and safe security status; leave unsupported mutations out of the MVP rather than adding nonfunctional controls.
- [ ] **Step 4: Run focused tests and architecture boundary tests.** Expected: no frontend direct database access is introduced.
- [ ] **Step 5: Commit.** Commit `feat: add admin dashboard and workspace settings`.

### Task 7: Add the Swagger-style API Documentation surface

**Files:**
- Create: `frontend/src/lib/api-docs.ts`
- Create: `frontend/src/components/admin/ApiDocumentation.tsx`
- Create: `frontend/src/routes/admin.api-docs.tsx`
- Create: `frontend/tests/component/admin/ApiDocumentation.test.tsx`

**Interfaces:**
- `apiOperations` is a typed, versioned OpenAPI-like definition containing only supported public client operations, methods, paths, auth/workspace requirements, request shapes, response shapes, and safe errors.
- `ApiDocumentation` renders an operation list and selected operation details without making a network request.

- [ ] **Step 1: Write failing content tests.** Assert the page lists the members and documents operations, states authentication/workspace requirements, and does not contain service-role keys, encryption keys, database URLs, or arbitrary SQL language.
- [ ] **Step 2: Implement the safe definition.** Use actual deployed function names and routes from the repository; use schema examples only, never fabricated user/document records.
- [ ] **Step 3: Implement the read-only reference UI.** Use the existing cards/tables/badges and the admin tab shell, with no “Try it out” control that could bypass the normal client contract.
- [ ] **Step 4: Run focused tests.** Expected: Owners/Administrators can render documentation; Bookkeepers cannot; secret-scan assertions pass.
- [ ] **Step 5: Commit.** Commit `feat: add administrator api documentation`.

### Task 8: Build paginated User Management UI

**Files:**
- Create: `frontend/src/components/admin/UserManagement.tsx`
- Create: `frontend/src/routes/admin.users.tsx`
- Create: `frontend/tests/component/admin/UserManagement.test.tsx`

**Interfaces:**
- The component accepts `api` and `workspaceId` dependencies or uses the existing app API wiring through a small typed hook; it must call only `listMembers`, `inviteMember`, `setMemberRole`, and `setMemberStatus`.
- The table renders one bounded page and exposes `Load more` only when `nextCursor` is present.

- [ ] **Step 1: Write failing UI tests.** Cover initial loading, empty state, one page of members, Load more cursor behavior, invite submission, role update, deactivate/reactivate actions, validation feedback, and safe API error display.
- [ ] **Step 2: Implement the bounded member table.** Keep member rows in local state by page, request the next cursor only on explicit action, and never request a page size above 100.
- [ ] **Step 3: Implement the invite form.** Use standard labels and controls for email and role; permit only Administrator and Bookkeeper roles; close/reset after a successful invitation and refresh the first page.
- [ ] **Step 4: Implement role/status actions.** Confirm destructive-looking deactivation with an existing dialog primitive, disable self-actions based on the authenticated user identity when available, and surface the server as the final authority.
- [ ] **Step 5: Implement empty/loading/error states.** Use actual labels and actionable copy; do not add fake users or filler statistics.
- [ ] **Step 6: Run focused component tests.** Expected: the UI remains bounded and all mutations map to the typed cloud API.
- [ ] **Step 7: Commit.** Commit `feat: add paginated user management ui`.

### Task 9: Regenerate routes and run the complete quality gate

**Files:**
- Modify: `frontend/src/routeTree.gen.ts` through the route-generation build only
- Modify: `README.md` only if a new verified local command needs documentation
- Modify: `docs/cloud-sync-operations.md` only if the public Edge Function contract needs a factual addition

- [ ] **Step 1: Run focused frontend tests.** Run `npm.cmd --prefix frontend run test -- tests/component/admin tests/unit/cloud/cloud-api.test.ts tests/architecture/frontend-data-boundary.test.ts`.
- [ ] **Step 2: Regenerate and type-check routes.** Run `npm.cmd run build`; verify the generated route tree includes `/admin`, `/admin/api-docs`, `/admin/users`, and `/admin/settings`.
- [ ] **Step 3: Run frontend lint and the full test suite.** Run `npm.cmd run lint` and `npm.cmd test`. Expected: exit code 0 with no skipped or focused tests.
- [ ] **Step 4: Run Edge and migration gates.** Run `node scripts/verify-supabase-migrations.mjs` and `node --experimental-strip-types --test supabase/functions/**/*.test.ts`.
- [ ] **Step 5: Review the diff for security boundaries.** Confirm no frontend `.from`, `.rpc`, Supabase table query, service-role string, secret, plaintext billing/quotation field, or historical migration edit was introduced.
- [ ] **Step 6: Verify hosted deployment when credentials are available.** Deploy the changed `members` and `workspace-context` functions, run authenticated CORS preflight checks, and verify the new endpoint returns `403` for a Bookkeeper and bounded results for an authorized Administrator.
- [ ] **Step 7: Commit the generated route tree and verified documentation only.** Commit `chore: verify administrator control plane integration`.

## Self-review

- **Spec coverage:** The role matrix is covered by Tasks 1, 2, 3, 5, 6, 7, and 8. The visual direction is covered by Task 5 and the content rules by Tasks 6–8. The no-direct-query and performance requirements are covered by Tasks 3, 4, 6, 8, and 9. Encryption/secret boundaries are covered by Tasks 6, 7, and 9. Immutable migrations are covered by Task 2 and the global constraints.
- **Placeholder scan:** No implementation step depends on an unspecified API, an unbounded query, a future migration edit, or a fabricated data source. The migration filename is fixed to the next sequence and the current Asia/Manila creation minute.
- **Type consistency:** `CloudMemberSummary`, `MemberCursor`, and `MemberPage` are introduced in Task 4 and consumed by the members API contract in Task 3 and User Management in Task 8. The role predicates introduced in Task 1 are consumed by Tasks 2, 3, 5, and 6.
- **Security review:** Administrator access is added to the explicit role policy, not inferred from UI visibility. Service-role dependencies are introduced only behind caller authorization. RLS self visibility is retained for workspace context while broad membership visibility is restricted to admin roles.

