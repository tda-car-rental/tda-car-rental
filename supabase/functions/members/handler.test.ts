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

test("owner can add an existing auth user without sending a duplicate invitation", async () => {
  let insertedUserId = "";
  let invitationCalls = 0;
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
    adminDbClient: {
      rpc(name: string, args: Record<string, string>) {
        assert.equal(name, "find_auth_user_by_email");
        assert.equal(args.target_email, "existing@example.invalid");
        return Promise.resolve({ data: [{ user_id: "existing-user-1", email: "existing@example.invalid" }], error: null });
      },
      from() {
        return {
          async insert(values: Record<string, unknown>) {
            insertedUserId = String(values.user_id);
            return { error: null };
          },
        };
      },
    },
    adminAuth: {
      async inviteUserByEmail() {
        invitationCalls += 1;
        throw new Error("not reached");
      },
    },
  });
  const response = await handler(new Request("https://edge.example/members", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ operation: "invite", email: "EXISTING@example.invalid", role: "bookkeeper" }),
  }));
  assert.equal(response.status, 201);
  assert.equal(insertedUserId, "existing-user-1");
  assert.equal(invitationCalls, 0);
});

test("administrator can read a bounded member page with an opaque next cursor", async () => {
  let requestedLimit = 0;
  let requestedCursor = "";
  const rows = [
    { user_id: "member-3", email: "three@example.invalid", role: "bookkeeper" as const, active: true, created_at: "2026-09-28T03:00:00.000Z", updated_at: "2026-09-28T03:00:00.000Z" },
    { user_id: "member-2", email: "two@example.invalid", role: "administrator" as const, active: true, created_at: "2026-09-28T02:00:00.000Z", updated_at: "2026-09-28T02:00:00.000Z" },
    { user_id: "member-1", email: null, role: "bookkeeper" as const, active: false, created_at: "2026-09-28T01:00:00.000Z", updated_at: "2026-09-28T01:00:00.000Z" },
  ];
  const memberQuery = {
    select() { return memberQuery; },
    eq() { return memberQuery; },
    lt() { return memberQuery; },
    ilike() { return memberQuery; },
    or(value: string) { requestedCursor = value; return memberQuery; },
    order() { return memberQuery; },
    async limit(value: number) { requestedLimit = value; return { data: rows, error: null }; },
    async maybeSingle() { return { data: null, error: null }; },
  };
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "administrator-1" } }, error: null }; } } },
    dbClient: {
      from() {
        return {
          select() { return this; }, eq() { return this; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }; },
        };
      },
    },
    adminDbClient: { from() { return memberQuery; } },
    adminAuth: { async inviteUserByEmail() { throw new Error("not reached"); } },
  });

  const response = await handler(new Request("https://edge.example/members?limit=2&search=member", {
    headers: { Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
  }));
  const payload = await response.json() as { members: unknown[]; nextCursor: string | null };
  assert.equal(response.status, 200);
  assert.equal(requestedLimit, 3);
  assert.equal(requestedCursor, "");
  assert.equal(payload.members.length, 2);
  assert.ok(payload.nextCursor);
});

test("bookkeeper cannot list members before the privileged dependency is touched", async () => {
  let privilegedReads = 0;
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
    adminDbClient: { from() { privilegedReads += 1; throw new Error("not reached"); } },
    adminAuth: { async inviteUserByEmail() { throw new Error("not reached"); } },
  });

  const response = await handler(new Request("https://edge.example/members", {
    headers: { Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
  }));
  assert.equal(response.status, 403);
  assert.equal(privilegedReads, 0);
});

test("member list rejects malformed cursors", async () => {
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "administrator-1" } }, error: null }; } } },
    dbClient: {
      from() {
        const builder = {
          select() { return builder; }, eq() { return builder; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }; },
        };
        return builder;
      },
    },
    adminDbClient: { from() { throw new Error("not reached"); } },
    adminAuth: { async inviteUserByEmail() { throw new Error("not reached"); } },
  });

  const response = await handler(new Request("https://edge.example/members?cursor=not-base64-json", {
    headers: { Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
  }));
  assert.equal(response.status, 400);
});

test("member operations cannot modify the owner membership", async () => {
  let updates = 0;
  const targetQuery = {
    select() { return targetQuery; }, eq() { return targetQuery; },
    async maybeSingle() { return { data: { user_id: "00000000-0000-0000-0000-000000000001", role: "owner" as const, active: true }, error: null }; },
  };
  const table = {
    select() { return targetQuery; },
    update() { updates += 1; return targetQuery; },
    async insert() { return { error: null }; },
  };
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "administrator-1" } }, error: null }; } } },
    dbClient: {
      from() {
        const builder = {
          select() { return builder; }, eq() { return builder; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }; },
        };
        return builder;
      },
    },
    adminDbClient: { from() { return table; } },
    adminAuth: { async inviteUserByEmail() { throw new Error("not reached"); } },
  });
  const response = await handler(new Request("https://edge.example/members", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ operation: "deactivate", userId: "00000000-0000-0000-0000-000000000001" }),
  }));
  assert.equal(response.status, 403);
  assert.equal(updates, 0);
});

test("administrator can delete a non-owner account through the isolated auth-admin dependency", async () => {
  let deletedUserId = "";
  let softDelete = false;
  let membershipDeleted = false;
  const targetQuery = {
    select() { return targetQuery; }, eq() { return targetQuery; },
    async maybeSingle() { return { data: { user_id: "member-user-1", role: "bookkeeper" as const, active: true }, error: null }; },
  };
  const deleteQuery = {
    eq() { membershipDeleted = true; return deleteQuery; },
  };
  const table = {
    select() { return targetQuery; },
    delete() { return deleteQuery; },
  };
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "administrator-1" } }, error: null }; } } },
    dbClient: {
      from() {
        const builder = {
          select() { return builder; }, eq() { return builder; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }; },
        };
        return builder;
      },
    },
    adminDbClient: { from() { return table; } },
    adminAuth: {
      async inviteUserByEmail() { throw new Error("not reached"); },
      async deleteUser(userId: string, shouldSoftDelete: boolean) {
        deletedUserId = userId;
        softDelete = shouldSoftDelete;
        return { data: { user: null }, error: null };
      },
    },
  });
  const response = await handler(new Request("https://edge.example/members", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ operation: "delete", userId: "member-user-1" }),
  }));
  assert.equal(response.status, 200);
  assert.equal(deletedUserId, "member-user-1");
  assert.equal(softDelete, true);
  assert.equal(membershipDeleted, true);
});

test("administrator cannot delete their own account", async () => {
  let authDeleteCalls = 0;
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "administrator-1" } }, error: null }; } } },
    dbClient: {
      from() {
        const builder = {
          select() { return builder; }, eq() { return builder; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }; },
        };
        return builder;
      },
    },
    adminDbClient: { from() { throw new Error("not reached"); } },
    adminAuth: {
      async inviteUserByEmail() { throw new Error("not reached"); },
      async deleteUser() { authDeleteCalls += 1; return { data: { user: null }, error: null }; },
    },
  });
  const response = await handler(new Request("https://edge.example/members", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ operation: "delete", userId: "administrator-1" }),
  }));
  assert.equal(response.status, 400);
  assert.equal(authDeleteCalls, 0);
});

test("administrator cannot delete an owner account", async () => {
  let authDeleteCalls = 0;
  const targetQuery = {
    select() { return targetQuery; }, eq() { return targetQuery; },
    async maybeSingle() { return { data: { user_id: "owner-user-1", role: "owner" as const, active: true }, error: null }; },
  };
  const handler = createMembersHandler({
    authClient: { auth: { async getUser() { return { data: { user: { id: "administrator-1" } }, error: null }; } } },
    dbClient: {
      from() {
        const builder = {
          select() { return builder; }, eq() { return builder; },
          async maybeSingle() { return { data: { workspace_id: "workspace-1", role: "administrator", active: true }, error: null }; },
        };
        return builder;
      },
    },
    adminDbClient: { from() { return { select() { return targetQuery; } }; } },
    adminAuth: {
      async inviteUserByEmail() { throw new Error("not reached"); },
      async deleteUser() { authDeleteCalls += 1; return { data: { user: null }, error: null }; },
    },
  });
  const response = await handler(new Request("https://edge.example/members", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: "Bearer token", "x-workspace-id": "workspace-1" },
    body: JSON.stringify({ operation: "delete", userId: "owner-user-1" }),
  }));
  assert.equal(response.status, 403);
  assert.equal(authDeleteCalls, 0);
});
