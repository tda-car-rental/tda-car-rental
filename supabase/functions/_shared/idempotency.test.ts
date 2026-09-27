import assert from "node:assert/strict";
import { test } from "node:test";
import { RepositoryConflictError, assertMutationResult, nextRevision } from "./idempotency.ts";

test("nextRevision increments only positive revisions", () => {
  assert.equal(nextRevision(1), 2);
  assert.equal(nextRevision(99), 100);
  assert.throws(() => nextRevision(0), /revision/i);
});

test("assertMutationResult turns a missing optimistic update into a conflict", () => {
  assert.throws(() => assertMutationResult(null), (error: unknown) => error instanceof RepositoryConflictError);
  const row = { id: "document-1", revision: 2 };
  assert.deepEqual(assertMutationResult(row), row);
});
