import { describe, expect, it, vi } from "vitest";
import { createSyncEngine, type SyncQueueCache } from "@/lib/sync-engine";

function createCache(): SyncQueueCache {
  let value: unknown = null;
  return {
    get: vi.fn(async () => value),
    put: vi.fn(async (_key: string, next: unknown) => {
      value = next;
    }),
    clear: vi.fn(async () => {
      value = null;
    }),
  };
}

describe("sync engine", () => {
  it("flushes queued mutations one at a time and removes successful entries", async () => {
    const cache = createCache();
    const seen: string[] = [];
    const api = {
      sync: vi.fn(async (_workspaceId: string, mutation: { mutationId: string }) => {
        seen.push(mutation.mutationId);
        return { ok: true };
      }),
    };
    let nextId = 1;
    const engine = createSyncEngine({ cache, api, workspaceId: "workspace-1", createMutationId: () => `id-${nextId++}` });

    await engine.enqueue({ operation: "create", document: { total: 10 } });
    await engine.enqueue({ operation: "create", document: { total: 20 } });
    await engine.flush();

    expect(seen).toEqual(["id-1", "id-2"]);
    expect(await engine.pending()).toHaveLength(0);
  });

  it("retains the failed mutation for a later retry", async () => {
    const cache = createCache();
    const api = { sync: vi.fn(async () => { throw new Error("offline"); }) };
    const engine = createSyncEngine({ cache, api, workspaceId: "workspace-1", createMutationId: () => "id-1" });

    await engine.enqueue({ operation: "update", id: "doc-1" });
    await expect(engine.flush()).rejects.toThrow("offline");
    expect(await engine.pending()).toHaveLength(1);
  });
});
