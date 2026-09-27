import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteEncryptedDocument, listEncryptedDocuments } from "./documents.ts";

test("listEncryptedDocuments selects ciphertext metadata and caps pages at 250", async () => {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      const builder = {
        select(columns: string) { calls.push(`select:${columns}`); return builder; },
        eq(column: string, value: unknown) { calls.push(`eq:${column}=${String(value)}`); return builder; },
        is(column: string, value: unknown) { calls.push(`is:${column}=${String(value)}`); return builder; },
        order(column: string, options: unknown) { calls.push(`order:${column}:${JSON.stringify(options)}`); return builder; },
        limit(value: number) { calls.push(`limit:${value}`); return Promise.resolve({ data: [], error: null }); },
      };
      return builder;
    },
  };

  const result = await listEncryptedDocuments(client, { workspaceId: "workspace-1", limit: 999 });
  assert.deepEqual(result, { rows: [], nextCursor: null });
  assert.equal(calls[0], "from:documents");
  assert.match(calls[1], /encrypted_iv/);
  assert.doesNotMatch(calls[1], /billed_to|items_json|total/);
  assert.equal(calls.at(-1), "limit:251");
});

test("deleteEncryptedDocument uses a revision guard and soft-deletes the row", async () => {
  const calls: string[] = [];
  const row = { id: "doc-1", deleted_at: "2026-09-27T12:00:00.000Z" };
  const client = {
    from() {
      const builder = {
        update(values: Record<string, unknown>) { calls.push(`update:${JSON.stringify(values)}`); return builder; },
        eq(column: string, value: unknown) { calls.push(`eq:${column}=${String(value)}`); return builder; },
        select() { return builder; },
        async maybeSingle() { return { data: row, error: null }; },
      };
      return builder;
    },
  };

  const result = await deleteEncryptedDocument(client, {
    workspaceId: "workspace-1",
    id: "doc-1",
    expectedRevision: 4,
    actorUserId: "user-1",
  });

  assert.equal(result, row);
  assert.match(calls[0], /deleted_at/);
  assert.ok(calls.includes("eq:revision=4"));
});
