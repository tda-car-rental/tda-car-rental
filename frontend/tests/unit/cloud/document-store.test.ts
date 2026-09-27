import { describe, expect, it, vi } from "vitest";
import { createCloudDocumentStore } from "@/lib/document-store";

const document = {
  id: "doc-1", workspace_id: "workspace-1", doc_type: "billing" as const, doc_date: "2026-09-27",
  billed_to: "Customer", unit: "Toyota", driver: "Driver", requestor: "", total: 1200, items_json: "[]",
  ack_ref_no: "", ack_amount: 0, ack_details: "", ack_received_by: "", ack_date_received: "",
  revision: 1, created_at: "2026-09-27T00:00:00.000Z", updated_at: "2026-09-27T00:00:00.000Z",
};

function createCache() {
  let value: unknown = null;
  return {
    async get<T>() { return value as T | null; },
    async put<T>(_key: string, next: T) { value = next; },
    async clear() { value = null; },
  };
}

describe("cloud document store", () => {
  it("uses the edge API for reads and maps cloud documents to the existing editor shape", async () => {
    const api = {
      listDocuments: vi.fn(async () => ({ documents: [document], nextCursor: null })),
      getDocument: vi.fn(async () => ({ document })),
      saveDocument: vi.fn(),
      deleteDocument: vi.fn(),
      sync: vi.fn(),
    };
    const store = createCloudDocumentStore({ api, workspaceId: "workspace-1", cache: createCache() });

    await expect(store.list()).resolves.toMatchObject([{ id: "doc-1", billed_to: "Customer" }]);
    expect(api.listDocuments).toHaveBeenCalledWith({ workspaceId: "workspace-1", limit: 250 });
    await expect(store.get("doc-1")).resolves.toMatchObject({ id: "doc-1", doc_type: "billing" });
  });

  it("queues an unsuccessful save instead of writing through a local database", async () => {
    const api = {
      listDocuments: vi.fn(async () => ({ documents: [], nextCursor: null })),
      getDocument: vi.fn(),
      saveDocument: vi.fn(async () => { throw new Error("offline"); }),
      deleteDocument: vi.fn(),
      sync: vi.fn(),
    };
    const store = createCloudDocumentStore({ api, workspaceId: "workspace-1", cache: createCache(), createMutationId: () => "mutation-1" });

    const saved = await store.save({ ...document, id: undefined } as never);

    expect(saved).toBeTypeOf("string");
    expect(api.sync).not.toHaveBeenCalled();
  });

  it("does not turn authorization failures into offline mutations", async () => {
    const api = {
      listDocuments: vi.fn(async () => ({ documents: [], nextCursor: null })),
      getDocument: vi.fn(),
      saveDocument: vi.fn(async () => {
        const { CloudApiError } = await import("@/lib/cloud-api");
        throw new CloudApiError("FORBIDDEN", 403, "Access denied.");
      }),
      deleteDocument: vi.fn(),
      sync: vi.fn(),
    };
    const store = createCloudDocumentStore({ api, workspaceId: "workspace-1", cache: createCache() });

    await expect(store.save({ ...document, id: undefined } as never)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(api.sync).not.toHaveBeenCalled();
  });
});
