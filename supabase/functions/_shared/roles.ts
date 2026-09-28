import { ApiError } from "./http.ts";

export type CloudRole = "owner" | "administrator" | "bookkeeper";
export type CloudDocumentKind = "billing" | "quotation" | "acknowledgement" | "contract";

const writableFinancialKinds = new Set<CloudDocumentKind>(["billing", "quotation", "acknowledgement"]);

export function canReadDocument(role: CloudRole, _kind: CloudDocumentKind): boolean {
  return role === "owner" || role === "administrator" || role === "bookkeeper";
}

export function canWriteDocument(role: CloudRole, kind: CloudDocumentKind): boolean {
  return role === "owner" || role === "administrator" || (role === "bookkeeper" && writableFinancialKinds.has(kind));
}

export function canManageMembers(role: CloudRole): boolean {
  return role === "owner" || role === "administrator";
}

export function canAccessAdmin(role: CloudRole): boolean {
  return role === "owner" || role === "administrator";
}

export function canManageWorkspaceSettings(role: CloudRole): boolean {
  return role === "owner";
}

export function requireRole(role: CloudRole, allowed: CloudRole[]): void {
  if (!allowed.includes(role)) throw new ApiError("FORBIDDEN", "Access denied.", 403);
}
