import { decryptJson, encryptJson, type CiphertextEnvelope } from "../_shared/crypto.ts";
import { requireUser, requireWorkspaceMember, type AuthClient, type WorkspaceClient } from "../_shared/auth.ts";
import {
  createEncryptedDocument,
  deleteEncryptedDocument,
  getEncryptedDocument,
  listEncryptedDocuments,
  updateEncryptedDocument,
  type EncryptedDocumentRow,
  type RepositoryClient,
} from "../_shared/documents.ts";
import { ApiError, handleOptions, jsonResponse, readJson } from "../_shared/http.ts";
import { canWriteDocument } from "../_shared/roles.ts";
import { validateDocumentInput, type DocumentInput } from "../_shared/validation.ts";

type DocumentsClient = AuthClient & WorkspaceClient & RepositoryClient & {
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
};

type HandlerDependencies = {
  authClient: AuthClient;
  dbClient: DocumentsClient;
  keyMaterial: Uint8Array;
  keyVersion: number;
};

type MutationRequest = {
  operation: "create" | "update" | "delete";
  id?: string;
  expectedRevision?: number;
  mutationId?: string;
  document?: unknown;
};

function workspaceId(request: Request): string {
  const value = request.headers.get("x-workspace-id")?.trim();
  if (!value) throw new ApiError("VALIDATION_FAILED", "Workspace is required.", 400);
  return value;
}

function cursor(value: string | null): { updatedAt: string; id: string } | undefined {
  if (!value) return undefined;
  try {
    const decoded = JSON.parse(atob(value)) as { updatedAt?: unknown; id?: unknown };
    if (typeof decoded.updatedAt !== "string" || typeof decoded.id !== "string") throw new Error("invalid");
    return { updatedAt: decoded.updatedAt, id: decoded.id };
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Cursor is invalid.", 400);
  }
}

function mutationId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError("VALIDATION_FAILED", "Mutation ID is invalid.", 400);
  }
  return value;
}

async function publicDocument(row: EncryptedDocumentRow, keyMaterial: Uint8Array) {
  const payload = await decryptJson<DocumentInput>({
    iv: row.encrypted_iv,
    ciphertext: row.encrypted_payload,
    keyVersion: row.encryption_key_version,
  } satisfies CiphertextEnvelope, keyMaterial);
  return {
    ...payload,
    id: row.id,
    workspace_id: row.workspace_id,
    revision: row.revision,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function audit(client: DocumentsClient, workspace: string, action: string, result: string, documentId?: string) {
  if (!client.rpc) return;
  const response = await client.rpc("write_audit_event", {
    target_workspace_id: workspace,
    target_action: action,
    target_result: result,
    target_document_id: documentId ?? null,
  });
  if (response.error) throw response.error;
}

export function createDocumentsHandler(deps: HandlerDependencies) {
  return async function handleDocuments(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return handleOptions(request);

    try {
      const user = await requireUser(request, deps.authClient);
      const workspace = workspaceId(request);
      const membership = await requireWorkspaceMember(deps.dbClient, workspace, user.id);

      if (request.method === "GET") {
        const url = new URL(request.url);
        const documentId = url.searchParams.get("documentId")?.trim();
        if (documentId) {
          const row = await getEncryptedDocument(deps.dbClient, { workspaceId: membership.workspaceId, id: documentId });
          await audit(deps.dbClient, membership.workspaceId, "read", "accepted", row.id);
          return jsonResponse({ document: await publicDocument(row, deps.keyMaterial) }, request);
        }
        const kind = url.searchParams.get("kind") as EncryptedDocumentRow["document_kind"] | null;
        const page = await listEncryptedDocuments(deps.dbClient, {
          workspaceId: membership.workspaceId,
          kind: kind ?? undefined,
          cursor: cursor(url.searchParams.get("cursor")),
          limit: Number(url.searchParams.get("limit") ?? 50),
        });
        const documents = await Promise.all(page.rows.map((row) => publicDocument(row, deps.keyMaterial)));
        await audit(deps.dbClient, membership.workspaceId, "read", "accepted");
        return jsonResponse({ documents, nextCursor: page.nextCursor ? btoa(JSON.stringify(page.nextCursor)) : null }, request);
      }

      if (request.method !== "POST") throw new ApiError("VALIDATION_FAILED", "Method is not supported.", 405);
      const body = await readJson<MutationRequest>(request);
      const operation = body.operation;
      if (operation !== "create" && operation !== "update" && operation !== "delete") {
        throw new ApiError("VALIDATION_FAILED", "Operation is invalid.", 400);
      }

      let row: EncryptedDocumentRow;
      if (operation === "create" || operation === "update") {
        const input = validateDocumentInput(body.document);
        if (!canWriteDocument(membership.role, input.doc_type)) throw new ApiError("FORBIDDEN", "Access denied.", 403);
        const encrypted = await encryptJson(input, deps.keyMaterial, deps.keyVersion);
        const mutation = mutationId(body.mutationId ?? request.headers.get("x-client-mutation-id"));
        const values = {
          workspaceId: membership.workspaceId,
          kind: input.doc_type,
          encryptedIv: encrypted.iv,
          encryptedPayload: encrypted.ciphertext,
          keyVersion: encrypted.keyVersion,
          mutationId: mutation,
          actorUserId: user.id,
        };
        if (operation === "create") row = await createEncryptedDocument(deps.dbClient, values);
        else {
          if (!body.id || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
            throw new ApiError("VALIDATION_FAILED", "Document revision is required.", 400);
          }
          row = await updateEncryptedDocument(deps.dbClient, { ...values, id: body.id, expectedRevision: body.expectedRevision });
        }
      } else {
        if (!body.id || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) {
          throw new ApiError("VALIDATION_FAILED", "Document revision is required.", 400);
        }
        row = await deleteEncryptedDocument(deps.dbClient, {
          workspaceId: membership.workspaceId,
          id: body.id,
          expectedRevision: body.expectedRevision,
          actorUserId: user.id,
        });
      }

      await audit(deps.dbClient, membership.workspaceId, operation === "delete" ? "delete" : operation, "accepted", row.id);
      return jsonResponse({ document: await publicDocument(row, deps.keyMaterial) }, request, operation === "create" ? 201 : 200);
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse(error, request);
      if (error?.constructor?.name === "RepositoryConflictError") {
        return jsonResponse(new ApiError("CONFLICT", "Document changed elsewhere.", 409), request);
      }
      return jsonResponse(new ApiError("INTERNAL_ERROR", "The document operation failed.", 500), request);
    }
  };
}
