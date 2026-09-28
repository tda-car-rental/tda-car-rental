export type ApiDocumentationOperation = {
  id: string;
  method: "GET" | "POST";
  path: string;
  summary: string;
  authentication: string;
  workspace: string;
  request: string;
  response: string;
  errors: string[];
};

export const apiOperations: ApiDocumentationOperation[] = [
  {
    id: "workspace-context",
    method: "GET",
    path: "/workspace-context",
    summary: "Resolve the signed-in user's active workspace and role.",
    authentication: "Bearer access token required.",
    workspace: "Optional x-workspace-id selects an accessible workspace.",
    request: "No request body.",
    response: "{ workspaceId, workspaceName, role, capabilities }",
    errors: ["401 UNAUTHENTICATED", "403 FORBIDDEN"],
  },
  {
    id: "members-list",
    method: "GET",
    path: "/members",
    summary: "Read a bounded page of workspace member summaries.",
    authentication: "Bearer access token required.",
    workspace: "x-workspace-id is required; Owner or Administrator role required.",
    request: "Query: limit (maximum 100), cursor, search (email prefix).",
    response: "{ members: [{ userId, email, role, active, createdAt, updatedAt }], nextCursor }",
    errors: ["400 VALIDATION_FAILED", "401 UNAUTHENTICATED", "403 FORBIDDEN"],
  },
  {
    id: "members-mutations",
    method: "POST",
    path: "/members",
    summary: "Invite, update, or delete an eligible member account.",
    authentication: "Bearer access token required.",
    workspace: "x-workspace-id is required; Owner or Administrator role required.",
    request:
      "JSON operation: invite, set-role, deactivate, reactivate, or delete. Owner assignment/deletion is not supported.",
    response: "Invite: { memberId }; role/status/delete: { ok, memberId }",
    errors: ["400 VALIDATION_FAILED", "401 UNAUTHENTICATED", "403 FORBIDDEN", "404 NOT_FOUND"],
  },
  {
    id: "documents",
    method: "GET",
    path: "/documents",
    summary: "Read encrypted document metadata through the authorized decryption boundary.",
    authentication: "Bearer access token required.",
    workspace: "x-workspace-id is required for the selected workspace.",
    request: "Query: kind, limit, cursor, documentId, or summary=1.",
    response: "Bounded document page, one authorized document, or metadata-only summary.",
    errors: ["400 VALIDATION_FAILED", "401 UNAUTHENTICATED", "403 FORBIDDEN", "404 NOT_FOUND"],
  },
  {
    id: "sync",
    method: "POST",
    path: "/sync",
    summary: "Submit exactly one authenticated document mutation for synchronization.",
    authentication: "Bearer access token required.",
    workspace: "x-workspace-id is required for the selected workspace.",
    request: "JSON { mutations: [one mutation] } with the existing document mutation contract.",
    response: "The authorized mutation result or a retryable/conflict response.",
    errors: ["400 VALIDATION_FAILED", "401 UNAUTHENTICATED", "403 FORBIDDEN", "409 CONFLICT"],
  },
];
