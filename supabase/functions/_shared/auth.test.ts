import assert from "node:assert/strict";
import { test } from "node:test";
import { requireUser, requireWorkspaceMember } from "./auth.ts";

test("requireUser validates a bearer token and returns only safe user identity", async () => {
  const client = {
    auth: {
      async getUser(token: string) {
        assert.equal(token, "access-token");
        return { data: { user: { id: "user-1", email: "user@example.invalid" } }, error: null };
      },
    },
  };
  const user = await requireUser(new Request("https://edge.example", { headers: { Authorization: "Bearer access-token" } }), client);
  assert.deepEqual(user, { id: "user-1", email: "user@example.invalid" });
});

test("requireUser rejects absent or invalid bearer tokens", async () => {
  await assert.rejects(() => requireUser(new Request("https://edge.example"), { auth: { getUser: async () => ({ data: { user: null }, error: null }) } }), /Authentication required/);
});

test("requireWorkspaceMember returns a workspace role", async () => {
  const client = {
    from(table: string) {
      assert.equal(table, "workspace_members");
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }; },
      };
    },
  };
  assert.deepEqual(await requireWorkspaceMember(client, "workspace-1", "user-1"), {
    workspaceId: "workspace-1",
    role: "administrator",
  });
});
