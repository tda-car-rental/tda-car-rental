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

type QueryResult<T> = { data: T | null; error: unknown };
type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  is(column: string, value: unknown): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  or?(expression: string): QueryBuilder;
  limit(value: number): Promise<QueryResult<EncryptedDocumentRow[]>>;
};

type RepositoryClient = { from(table: string): QueryBuilder };

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

export { SELECT_COLUMNS };
