import assert from "node:assert/strict";
import { test } from "node:test";
import { createMembersHandler } from "./handler.ts";

test("owner can invite a member through the isolated auth-admin dependency", async () => {
  let invitedEmail = "";
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "owner-1" } }, error: null }; } } },
    dbClient: {
      from() {
        const builder = {
          select() { return builder; }, eq() { return builder; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "owner", active: true }, error: null }; },
          insert() { return builder; },
          async then(resolve: (value: unknown) => unknown) { return resolve({ data: null, error: null }); },
        };
        return builder;
      },
    },
    adminAuth: { async inviteUserByEmail(email: string) { invitedEmail = email; return { data: { user: { id: "member-1" } }, error: null }; } },
  });
  const response = await handler(new Request("https://edge.example/members", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ operation: "invite", email: "bookkeeper@example.invalid", role: "bookkeeper" }),
  }));
  assert.equal(response.status, 201);
  assert.equal(invitedEmail, "bookkeeper@example.invalid");
});

test("non-owner cannot manage members", async () => {
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "bookkeeper-1" } }, error: null }; } } },
    dbClient: {
      from() {
        const builder = {
          select() { return builder; }, eq() { return builder; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "bookkeeper", active: true }, error: null }; },
        };
        return builder;
      },
    },
    adminAuth: { async inviteUserByEmail() { throw new Error("not reached"); } },
  });
  const response = await handler(new Request("https://edge.example/members", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ operation: "invite", email: "member@example.invalid", role: "bookkeeper" }),
  }));
  assert.equal(response.status, 403);
});

test("owner cannot create or assign another owner through member administration", async () => {
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "owner-1" } }, error: null }; } } },
    dbClient: {
      from() {
        const builder = {
          select() { return builder; }, eq() { return builder; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "owner", active: true }, error: null }; },
        };
        return builder;
      },
    },
    adminAuth: { async inviteUserByEmail() { throw new Error("not reached"); } },
  });

  const response = await handler(new Request("https://edge.example/members", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ operation: "invite", email: "owner2@example.invalid", role: "owner" }),
  }));
  assert.equal(response.status, 400);
});
