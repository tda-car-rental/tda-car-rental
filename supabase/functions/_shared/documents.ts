export type EncryptedDocumentRow = {
  id: string;
  workspace_id: string;
  document_kind: "billing" | "quotation" | "acknowledgement" | "contract";
  encrypted_iv: string;
  encrypted_payload: string;
  encryption_key_version: number;
  revision: number;
  client_mutation_id: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DocumentCursor = { updatedAt: string; id: string };

export type EncryptedMutationInput = {
  workspaceId: string;
  kind: EncryptedDocumentRow["document_kind"];
  encryptedIv: string;
  encryptedPayload: string;
  keyVersion: number;
  mutationId: string;
  actorUserId: string;
};

export function buildEncryptedDocumentValues(input: EncryptedMutationInput) {
  return {
    workspace_id: input.workspaceId,
    document_kind: input.kind,
    encrypted_iv: input.encryptedIv,
    encrypted_payload: input.encryptedPayload,
    encryption_key_version: input.keyVersion,
    client_mutation_id: input.mutationId,
    created_by: input.actorUserId,
    updated_by: input.actorUserId,
  };
}

type QueryResult<T> = { data: T | null; error: unknown };
export type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  is(column: string, value: unknown): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  or?(expression: string): QueryBuilder;
  limit(value: number): Promise<QueryResult<EncryptedDocumentRow[]>>;
  insert?(values: Record<string, unknown>): QueryBuilder;
  update?(values: Record<string, unknown>): QueryBuilder;
  maybeSingle?(): Promise<QueryResult<EncryptedDocumentRow>>;
};

export type RepositoryClient = { from(table: string): QueryBuilder };

const SELECT_COLUMNS = [
  "id",
  "workspace_id",
  "document_kind",
  "encrypted_iv",
  "encrypted_payload",
  "encryption_key_version",
  "revision",
  "client_mutation_id",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
  "deleted_at",
].join(",");

export function normalizePageLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(Math.max(Math.trunc(value as number), 1), 250);
}

function cursorFilter(cursor: DocumentCursor): string {
  return `updated_at.lt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.lt.${cursor.id})`;
}

export async function listEncryptedDocuments(
  client: RepositoryClient,
  input: { workspaceId: string; kind?: EncryptedDocumentRow["document_kind"]; cursor?: DocumentCursor; limit?: number },
): Promise<{ rows: EncryptedDocumentRow[]; nextCursor: DocumentCursor | null }> {
  const limit = normalizePageLimit(input.limit);
  let query = client
    .from("documents")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (input.kind) query = query.eq("document_kind", input.kind);
  if (input.cursor && query.or) query = query.or(cursorFilter(input.cursor));

  const result = await query.limit(limit + 1);
  if (result.error) throw result.error;
  const rows = result.data ?? [];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor: rows.length > limit && last ? { updatedAt: last.updated_at, id: last.id } : null,
  };
}

export async function createEncryptedDocument(
  client: RepositoryClient,
  input: EncryptedMutationInput,
): Promise<EncryptedDocumentRow> {
  const query = client.from("documents");
  if (!query.insert || !query.maybeSingle) throw new Error("Document client does not support writes.");
  const result = await query.insert(buildEncryptedDocumentValues(input)).select(SELECT_COLUMNS).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Document create did not return a row.");
  return result.data;
}

export async function getEncryptedDocument(
  client: RepositoryClient,
  input: { workspaceId: string; id: string },
): Promise<EncryptedDocumentRow> {
  const query = client
    .from("documents")
    .select(SELECT_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.id)
    .is("deleted_at", null);
  if (!query.maybeSingle) throw new Error("Document client does not support single-row reads.");
  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Document was not found.");
  return result.data;
}

export async function updateEncryptedDocument(
  client: RepositoryClient,
  input: EncryptedMutationInput & { id: string; expectedRevision: number },
): Promise<EncryptedDocumentRow> {
  const query = client.from("documents");
  if (!query.update || !query.maybeSingle) throw new Error("Document client does not support writes.");
  const result = await query
    .update({
      document_kind: input.kind,
      encrypted_iv: input.encryptedIv,
      encrypted_payload: input.encryptedPayload,
      encryption_key_version: input.keyVersion,
      client_mutation_id: input.mutationId,
      updated_by: input.actorUserId,
      revision: input.expectedRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.id)
    .eq("revision", input.expectedRevision)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    const { RepositoryConflictError } = await import("./idempotency.ts");
    throw new RepositoryConflictError();
  }
  return result.data;
}

export async function deleteEncryptedDocument(
  client: RepositoryClient,
  input: { workspaceId: string; id: string; expectedRevision: number; actorUserId: string },
): Promise<EncryptedDocumentRow> {
  const query = client.from("documents");
  if (!query.update || !query.maybeSingle) throw new Error("Document client does not support writes.");
  const result = await query
    .update({ deleted_at: new Date().toISOString(), updated_by: input.actorUserId, revision: input.expectedRevision + 1 })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.id)
    .eq("revision", input.expectedRevision)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    const { RepositoryConflictError } = await import("./idempotency.ts");
    throw new RepositoryConflictError();
  }
  return result.data;
}

export { SELECT_COLUMNS };
