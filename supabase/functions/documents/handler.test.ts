import assert from "node:assert/strict";
import { test } from "node:test";
import { encryptJson } from "../_shared/crypto.ts";
import { createDocumentsHandler } from "./handler.ts";

test("documents handler returns an authorized bounded page", async () => {
  const handler = createDocumentsHandler({
    authClient: {
      auth: { async getUser() { return { data: { user: { id: "user-1" } }, error: null }; } },
    },
    dbClient: {
      from(table: string) {
        if (table === "workspace_members") {
          const builder = {
            select() { return builder; },
            eq() { return builder; },
            async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }; },
          };
          return builder;
        }
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          is() { return builder; },
          order() { return builder; },
          async limit() { return { data: [], error: null }; },
        };
        return builder;
      },
    },
    keyMaterial: Uint8Array.from({ length: 32 }, (_, index) => index),
    keyVersion: 1,
  });

  const response = await handler(
    new Request("https://edge.example/documents", {
      headers: { Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { documents: [], nextCursor: null });
});

test("documents handler rejects a missing workspace without querying documents", async () => {
  let documentQueryCount = 0;
  const handler = createDocumentsHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "user-1" } }, error: null }; } } },
    dbClient: {
      from(table: string) {
        if (table === "documents") documentQueryCount += 1;
        throw new Error("membership should not be queried");
      },
    },
    keyMaterial: new Uint8Array(32),
    keyVersion: 1,
  });
  const response = await handler(new Request("https://edge.example/documents", { headers: { Authorization: "Bearer token" } }));
  assert.equal(response.status, 400);
  assert.equal(documentQueryCount, 0);
});

test("documents handler returns one decrypted document through the authorized edge boundary", async () => {
  const key = Uint8Array.from({ length: 32 }, (_, index) => index);
  const encrypted = await encryptJson({
    doc_type: "billing", doc_date: "2026-09-27", billed_to: "Sensitive customer", unit: "Toyota",
    driver: "Driver", requestor: "", total: 1200, items_json: "[]", ack_ref_no: "", ack_amount: 0,
    ack_details: "", ack_received_by: "", ack_date_received: "",
  }, key, 1);
  const handler = createDocumentsHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "user-1" } }, error: null }; } } },
    dbClient: {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          is() { return builder; },
          async maybeSingle() {
            return table === "workspace_members"
              ? { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }
              : {
                data: {
                  id: "doc-1", workspace_id: "workspace-1", document_kind: "billing",
                  encrypted_iv: encrypted.iv, encrypted_payload: encrypted.ciphertext, encryption_key_version: 1,
                  revision: 1, client_mutation_id: "00000000-0000-4000-8000-000000000001", created_by: "user-1",
                  updated_by: "user-1", created_at: "2026-09-27T00:00:00.000Z", updated_at: "2026-09-27T00:00:00.000Z", deleted_at: null,
                },
                error: null,
              };
          },
        };
        return builder;
      },
    },
    keyMaterial: key,
    keyVersion: 1,
  });
  const response = await handler(new Request("https://edge.example/documents?documentId=doc-1", {
    headers: { Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).document.billed_to, "Sensitive customer");
});
