import assert from "node:assert/strict";
import { test } from "node:test";
import { createSyncHandler } from "./handler.ts";

test("sync accepts exactly one mutation and delegates it to the document api", async () => {
  let delegated: Request | undefined;
  const handler = createSyncHandler({
    documentHandler: async (request) => {
      delegated = request;
      return new Response(JSON.stringify({ document: { id: "document-1" } }), { status: 201 });
    },
  });

  const response = await handler(new Request("https://edge.example/sync", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ mutations: [{ operation: "create", mutationId: "mutation-1" }] }),
  }));
  assert.equal(response.status, 201);
  assert.equal(delegated?.method, "POST");
  assert.deepEqual(await delegated?.json(), { operation: "create", mutationId: "mutation-1" });
});

test("sync rejects a batch so device mutations remain single-flight", async () => {
  const handler = createSyncHandler({ documentHandler: async () => new Response(null, { status: 201 }) });
  const response = await handler(new Request("https://edge.example/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mutations: [{ operation: "create" }, { operation: "create" }] }),
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { code: "VALIDATION_FAILED", message: "One mutation is required." } });
});
