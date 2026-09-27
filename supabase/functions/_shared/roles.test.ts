import assert from "node:assert/strict";
import { test } from "node:test";
import { canManageMembers, canReadDocument, canWriteDocument, requireRole } from "./roles.ts";

test("role capabilities match the approved role matrix", () => {
  assert.equal(canReadDocument("bookkeeper", "contract"), true);
  assert.equal(canWriteDocument("bookkeeper", "billing"), true);
  assert.equal(canWriteDocument("bookkeeper", "contract"), false);
  assert.equal(canWriteDocument("administrator", "contract"), true);
  assert.equal(canManageMembers("administrator"), false);
  assert.equal(canManageMembers("owner"), true);
});

test("requireRole rejects a role without leaking membership details", () => {
  assert.throws(() => requireRole("bookkeeper", ["owner"]), /Access denied/);
});
