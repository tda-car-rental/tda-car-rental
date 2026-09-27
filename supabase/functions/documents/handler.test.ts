import assert from "node:assert/strict";
import { test } from "node:test";
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
