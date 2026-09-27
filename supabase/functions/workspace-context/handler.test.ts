import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceContextHandler } from "./handler.ts";

test("workspace context returns role capabilities only for an active member", async () => {
  const handler = createWorkspaceContextHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "user-1" } }, error: null }; } } },
    dbClient: {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return table === "workspace_members"
              ? { data: { workspace_id: "workspace-1", role: "bookkeeper", active: true }, error: null }
              : { data: { id: "workspace-1", name: "TDA Car Rental" }, error: null };
          },
        };
        return builder;
      },
    },
  });
  const response = await handler(new Request("https://edge.example/context", { headers: { Authorization: "Bearer token" } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    workspaceId: "workspace-1",
    workspaceName: "TDA Car Rental",
    role: "bookkeeper",
    capabilities: { canManageMembers: false, canWriteContracts: false },
  });
});

test("workspace context discovers the signed-in user's active workspace", async () => {
  const handler = createWorkspaceContextHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "user-1" } }, error: null }; } } },
    dbClient: {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          async maybeSingle() {
            return table === "workspace_members"
              ? { data: { workspace_id: "workspace-1", role: "owner", active: true }, error: null }
              : { data: { id: "workspace-1", name: "TDA Car Rental" }, error: null };
          },
        };
        return builder;
      },
    },
  });

  const response = await handler(new Request("https://edge.example/context", { headers: { Authorization: "Bearer token" } }));
  assert.equal(response.status, 200);
});
