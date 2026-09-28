import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canAccessAdmin,
  canManageMembers,
  canManageWorkspaceSettings,
  canReadDocument,
  canWriteDocument,
  requireRole,
} from "./roles.ts";

test("role capabilities match the approved role matrix", () => {
  assert.equal(canReadDocument("bookkeeper", "contract"), true);
  assert.equal(canWriteDocument("bookkeeper", "billing"), true);
  assert.equal(canWriteDocument("bookkeeper", "contract"), false);
  assert.equal(canWriteDocument("administrator", "contract"), true);
  assert.equal(canAccessAdmin("owner"), true);
  assert.equal(canAccessAdmin("administrator"), true);
  assert.equal(canAccessAdmin("bookkeeper"), false);
  assert.equal(canManageMembers("administrator"), true);
  assert.equal(canManageMembers("owner"), true);
  assert.equal(canManageMembers("bookkeeper"), false);
  assert.equal(canManageWorkspaceSettings("owner"), true);
  assert.equal(canManageWorkspaceSettings("administrator"), false);
  assert.equal(canManageWorkspaceSettings("bookkeeper"), false);
});

test("requireRole rejects a role without leaking membership details", () => {
  assert.throws(() => requireRole("bookkeeper", ["owner"]), /Access denied/);
});
