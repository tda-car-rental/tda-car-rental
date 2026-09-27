import { ApiError } from "./http.ts";
import type { CloudRole } from "./roles.ts";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

type AuthClient = {
  auth: {
    getUser(token: string): Promise<{ data: { user: { id: string; email?: string } | null }; error: unknown }>;
  };
};

type WorkspaceClient = {
  from(table: string): {
    select(columns: string): unknown;
  };
};

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match) throw new ApiError("UNAUTHENTICATED", "Authentication required.", 401);
  return match[1];
}

export async function requireUser(request: Request, client: AuthClient): Promise<AuthenticatedUser> {
  const token = bearerToken(request);
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.id) throw new Error("Invalid user");
    return { id: data.user.id, ...(data.user.email ? { email: data.user.email } : {}) };
  } catch {
    throw new ApiError("UNAUTHENTICATED", "Authentication required.", 401);
  }
}

export async function requireWorkspaceMember(
  client: WorkspaceClient,
  workspaceId: string,
  userId: string,
): Promise<{ workspaceId: string; role: CloudRole }> {
  const query = client.from("workspace_members").select("workspace_id, role, active") as {
    eq(column: string, value: string | boolean): unknown;
    maybeSingle(): Promise<{ data: { workspace_id: string; role: CloudRole; active: boolean } | null; error: unknown }>;
  };
  const workspaceQuery = query.eq("workspace_id", workspaceId) as typeof query;
  const userQuery = workspaceQuery.eq("user_id", userId) as typeof query;
  const result = await (userQuery.eq("active", true) as typeof query).maybeSingle();
  if (result.error || !result.data?.active) throw new ApiError("FORBIDDEN", "Access denied.", 403);
  return { workspaceId: result.data.workspace_id, role: result.data.role };
}
