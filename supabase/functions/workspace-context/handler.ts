import { requireUser, requireWorkspaceMember, type AuthClient, type WorkspaceClient } from "../_shared/auth.ts";
import { handleOptions, jsonResponse, ApiError } from "../_shared/http.ts";
import { canManageMembers, canWriteDocument } from "../_shared/roles.ts";

type ContextDependencies = { authClient: AuthClient; dbClient: WorkspaceClient };

export function createWorkspaceContextHandler(deps: ContextDependencies) {
  return async function handleWorkspaceContext(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return handleOptions(request);
    try {
      const user = await requireUser(request, deps.authClient);
      const member = await requireWorkspaceMember(deps.dbClient, request.headers.get("x-workspace-id") ?? "", user.id);
      const query = deps.dbClient.from("workspaces").select("id, name") as {
        eq(column: string, value: string): unknown;
        maybeSingle(): Promise<{ data: { id: string; name: string } | null; error: unknown }>;
      };
      const workspace = await (query.eq("id", member.workspaceId) as typeof query).maybeSingle();
      if (workspace.error || !workspace.data) throw new ApiError("FORBIDDEN", "Access denied.", 403);
      return jsonResponse({
        workspaceId: member.workspaceId,
        workspaceName: workspace.data.name,
        role: member.role,
        capabilities: {
          canManageMembers: canManageMembers(member.role),
          canWriteContracts: canWriteDocument(member.role, "contract"),
        },
      }, request);
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse(error, request);
      return jsonResponse(new ApiError("INTERNAL_ERROR", "Workspace context is unavailable.", 500), request);
    }
  };
}
