import { requireUser, requireWorkspaceMember, type AuthClient, type WorkspaceClient } from "../_shared/auth.ts";
import { ApiError, handleOptions, jsonResponse, readJson } from "../_shared/http.ts";
import { canManageMembers } from "../_shared/roles.ts";

type AdminAuth = {
  inviteUserByEmail(email: string, options: { data: Record<string, string> }): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
};

type MemberRow = {
  user_id: string;
  email: string | null;
  role: "owner" | "administrator" | "bookkeeper";
  active: boolean;
  created_at: string;
  updated_at: string;
};

type MemberQuery = {
  select(columns: string): MemberQuery;
  eq(column: string, value: string | boolean): MemberQuery;
  lt(column: string, value: string): MemberQuery;
  ilike(column: string, value: string): MemberQuery;
  or(value: string): MemberQuery;
  order(column: string, options: { ascending: boolean }): MemberQuery;
  limit(value: number): Promise<{ data: MemberRow[] | null; error: unknown }>;
  maybeSingle(): Promise<{ data: Pick<MemberRow, "user_id" | "role" | "active"> | null; error: unknown }>;
};

type MemberTable = {
  select(columns: string): MemberQuery;
  insert(values: Record<string, unknown>): Promise<{ error: unknown }>;
  update(values: Record<string, unknown>): MemberUpdateQuery;
};

type MemberUpdateQuery = {
  eq(column: string, value: string | boolean): MemberUpdateQuery;
};

type MembersDependencies = {
  authClient: AuthClient;
  dbClient: WorkspaceClient;
  adminDbClient?: WorkspaceClient;
  adminAuth: AdminAuth;
};
type MemberRole = "administrator" | "bookkeeper";
type MemberRequest = { operation: "invite" | "set-role" | "deactivate" | "reactivate"; email?: string; userId?: string; role?: string };
const assignableRoles = new Set(["administrator", "bookkeeper"]);
const pageSize = 50;
const maximumPageSize = 100;

function privilegedClient(deps: MembersDependencies): WorkspaceClient {
  return deps.adminDbClient ?? deps.dbClient;
}

function parseLimit(value: string | null): number {
  if (value === null || value === "") return pageSize;
  if (!/^\d+$/.test(value)) throw new ApiError("VALIDATION_FAILED", "Member limit is invalid.", 400);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new ApiError("VALIDATION_FAILED", "Member limit is invalid.", 400);
  return Math.min(parsed, maximumPageSize);
}

function parseCursor(value: string | null): { createdAt: string; userId: string } | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(atob(value)) as { createdAt?: unknown; userId?: unknown };
    if (typeof parsed.createdAt !== "string" || !parsed.createdAt || typeof parsed.userId !== "string" || !parsed.userId) throw new Error("invalid");
    return { createdAt: parsed.createdAt, userId: parsed.userId };
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Member cursor is invalid.", 400);
  }
}

function searchValue(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed.length > 120 || !/^[a-z0-9._+@ -]+$/.test(trimmed)) {
    throw new ApiError("VALIDATION_FAILED", "Member search is invalid.", 400);
  }
  return trimmed.replace(/[\\%(),]/g, (character) => `\\${character}`);
}

function memberSummary(row: MemberRow) {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listMembers(deps: MembersDependencies, workspaceId: string, url: URL) {
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = parseCursor(url.searchParams.get("cursor"));
  const search = searchValue(url.searchParams.get("search"));
  const query = privilegedClient(deps).from("workspace_members").select("user_id, email, role, active, created_at, updated_at") as unknown as MemberQuery;
  query.eq("workspace_id", workspaceId).order("created_at", { ascending: false }).order("user_id", { ascending: false });
  if (cursor) {
    query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},user_id.lt.${cursor.userId})`);
  }
  if (search) query.ilike("email", `${search}%`);
  const result = await query.limit(limit + 1);
  if (result.error || !result.data) throw new ApiError("INTERNAL_ERROR", "Members could not be loaded.", 500);
  const rows = result.data;
  const visibleRows = rows.slice(0, limit);
  const last = visibleRows.at(-1);
  return {
    members: visibleRows.map(memberSummary),
    nextCursor: rows.length > limit && last ? btoa(JSON.stringify({ createdAt: last.created_at, userId: last.user_id })) : null,
  };
}

export function createMembersHandler(deps: MembersDependencies) {
  return async function handleMembers(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return handleOptions(request);
    try {
      if (request.method !== "GET" && request.method !== "POST") throw new ApiError("VALIDATION_FAILED", "Method is not supported.", 405);
      const user = await requireUser(request, deps.authClient);
      const workspaceId = request.headers.get("x-workspace-id")?.trim();
      if (!workspaceId) throw new ApiError("VALIDATION_FAILED", "Workspace is required.", 400);
      const membership = await requireWorkspaceMember(deps.dbClient, workspaceId, user.id);
      if (!canManageMembers(membership.role)) throw new ApiError("FORBIDDEN", "Access denied.", 403);
      if (request.method === "GET") return jsonResponse(await listMembers(deps, membership.workspaceId, new URL(request.url)), request);
      const body = await readJson<MemberRequest>(request);
      if (!body.operation || !["invite", "set-role", "deactivate", "reactivate"].includes(body.operation)) {
        throw new ApiError("VALIDATION_FAILED", "Member operation is invalid.", 400);
      }

      if (body.operation === "invite") {
        if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || typeof body.role !== "string" || !assignableRoles.has(body.role)) {
          throw new ApiError("VALIDATION_FAILED", "Invitation details are invalid.", 400);
        }
        const invited = await deps.adminAuth.inviteUserByEmail(body.email.toLowerCase(), {
          data: { workspace_id: workspaceId, role: body.role },
        });
        if (invited.error || !invited.data.user) throw new ApiError("INTERNAL_ERROR", "Invitation could not be sent.", 500);
        const table = privilegedClient(deps).from("workspace_members") as unknown as MemberTable;
        const result = await table.insert({ workspace_id: workspaceId, user_id: invited.data.user.id, email: body.email.toLowerCase(), role: body.role, active: true });
        if (result.error) throw result.error;
        return jsonResponse({ memberId: invited.data.user.id }, request, 201);
      }

      if (typeof body.userId !== "string" || body.userId.length < 10) {
        throw new ApiError("VALIDATION_FAILED", "Member identity is invalid.", 400);
      }
      if (body.operation === "deactivate" && body.userId === user.id) {
        throw new ApiError("VALIDATION_FAILED", "You cannot deactivate your own account.", 400);
      }
      if (body.operation === "set-role" && (typeof body.role !== "string" || !assignableRoles.has(body.role) || body.userId === user.id)) {
        throw new ApiError("VALIDATION_FAILED", "Member role is invalid.", 400);
      }
      const table = privilegedClient(deps).from("workspace_members") as unknown as MemberTable;
      const targetQuery = table.select("user_id, role, active");
      const targetResult = await targetQuery.eq("workspace_id", workspaceId).eq("user_id", body.userId).maybeSingle();
      if (targetResult.error) throw targetResult.error;
      if (!targetResult.data) throw new ApiError("NOT_FOUND", "Member was not found.", 404);
      if (targetResult.data.role === "owner") throw new ApiError("FORBIDDEN", "Owner membership cannot be changed here.", 403);
      const values = body.operation === "set-role" ? { role: body.role } : { active: body.operation === "reactivate" };
      const result = await (table.update(values).eq("workspace_id", workspaceId).eq("user_id", body.userId) as unknown as Promise<{ error: unknown }>);
      if (result.error) throw result.error;
      return jsonResponse({ ok: true, memberId: body.userId }, request);
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse(error, request);
      return jsonResponse(new ApiError("INTERNAL_ERROR", "Member operation failed.", 500), request);
    }
  };
}
