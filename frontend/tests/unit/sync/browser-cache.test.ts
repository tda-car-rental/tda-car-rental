import { describe, expect, it } from "vitest";
import { createIndexedDbBlobStore } from "@/lib/browser-cache";

function createFakeIndexedDb() {
  const records = new Map<string, string>();
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    transaction: () => ({
      objectStore: () => ({
        get: (key: string) => request(records.get(key) ?? undefined),
        put: (value: string, key: string) => {
          records.set(key, value);
          return request(undefined);
        },
        delete: (key: string) => {
          records.delete(key);
          return request(undefined);
        },
        clear: () => {
          records.clear();
          return request(undefined);
        },
      }),
    }),
  };
  return {
    open: () => {
      const result = request(database);
      queueMicrotask(() => result.onsuccess?.());
      return result;
    },
  };
}

function request(result: unknown) {
  const response = {
    result,
    error: null,
    onsuccess: undefined as (() => void) | undefined,
    onerror: undefined as (() => void) | undefined,
  };
  queueMicrotask(() => response.onsuccess?.());
  return response;
}

describe("IndexedDB blob store", () => {
  it("stores, reads, and clears opaque cache blobs", async () => {
    const store = createIndexedDbBlobStore({ indexedDB: createFakeIndexedDb() as never });
    await store.set("document-1", "opaque-ciphertext");

    await expect(store.get("document-1")).resolves.toBe("opaque-ciphertext");
    await store.clear();
    await expect(store.get("document-1")).resolves.toBeNull();
  });
});
