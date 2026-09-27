import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEncryptedDocumentValues } from "./documents.ts";

test("buildEncryptedDocumentValues contains no plaintext document fields", () => {
  const values = buildEncryptedDocumentValues({
    workspaceId: "workspace-1",
    kind: "billing",
    encryptedIv: "iv",
    encryptedPayload: "ciphertext",
    keyVersion: 1,
    mutationId: "mutation-1",
    actorUserId: "user-1",
  });

  assert.deepEqual(values, {
    workspace_id: "workspace-1",
    document_kind: "billing",
    encrypted_iv: "iv",
    encrypted_payload: "ciphertext",
    encryption_key_version: 1,
    client_mutation_id: "mutation-1",
    created_by: "user-1",
    updated_by: "user-1",
  });
  assert.equal("billed_to" in values, false);
  assert.equal("items_json" in values, false);
});
