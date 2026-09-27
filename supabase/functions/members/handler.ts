import { requireUser, requireWorkspaceMember, type AuthClient, type WorkspaceClient } from "../_shared/auth.ts";
import { ApiError, handleOptions, jsonResponse, readJson } from "../_shared/http.ts";
import { canManageMembers } from "../_shared/roles.ts";

type AdminAuth = {
  inviteUserByEmail(email: string, options: { data: Record<string, string> }): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
};

type MembersDependencies = { authClient: AuthClient; dbClient: WorkspaceClient; adminAuth: AdminAuth };
type MemberRequest = { operation: "invite" | "set-role" | "deactivate" | "reactivate"; email?: string; userId?: string; role?: string };
const roles = new Set(["owner", "administrator", "bookkeeper"]);
const assignableRoles = new Set(["administrator", "bookkeeper"]);

export function createMembersHandler(deps: MembersDependencies) {
  return async function handleMembers(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return handleOptions(request);
    try {
      if (request.method !== "POST") throw new ApiError("VALIDATION_FAILED", "Method is not supported.", 405);
      const user = await requireUser(request, deps.authClient);
      const workspaceId = request.headers.get("x-workspace-id")?.trim();
      if (!workspaceId) throw new ApiError("VALIDATION_FAILED", "Workspace is required.", 400);
      const membership = await requireWorkspaceMember(deps.dbClient, workspaceId, user.id);
      if (!canManageMembers(membership.role)) throw new ApiError("FORBIDDEN", "Access denied.", 403);
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
        const insert = deps.dbClient.from("workspace_members") as unknown as { insert(values: Record<string, unknown>): Promise<{ error: unknown }> };
        const result = await insert.insert({ workspace_id: workspaceId, user_id: invited.data.user.id, role: body.role, active: true });
        if (result.error) throw result.error;
        return jsonResponse({ memberId: invited.data.user.id }, request, 201);
      }

      if (typeof body.userId !== "string" || body.userId.length < 10) {
        throw new ApiError("VALIDATION_FAILED", "Member identity is invalid.", 400);
      }
      if (body.operation === "deactivate" && body.userId === user.id) {
        throw new ApiError("VALIDATION_FAILED", "The Owner cannot deactivate their own account.", 400);
      }
      if (body.operation === "set-role" && (typeof body.role !== "string" || !assignableRoles.has(body.role) || body.userId === user.id)) {
        throw new ApiError("VALIDATION_FAILED", "Member role is invalid.", 400);
      }
      const update = deps.dbClient.from("workspace_members") as unknown as {
        update(values: Record<string, unknown>): { eq(column: string, value: unknown): { eq(column: string, value: unknown): Promise<{ error: unknown }> } };
      };
      const values = body.operation === "set-role" ? { role: body.role } : { active: body.operation === "reactivate" };
      const result = await update.update(values).eq("workspace_id", workspaceId).eq("user_id", body.userId);
      if (result.error) throw result.error;
      return jsonResponse({ ok: true }, request);
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse(error, request);
      return jsonResponse(new ApiError("INTERNAL_ERROR", "Member operation failed.", 500), request);
    }
  };
}
