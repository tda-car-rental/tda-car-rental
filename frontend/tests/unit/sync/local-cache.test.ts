import { webcrypto } from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";
import { createEncryptedLocalCache, createMemoryBlobStore, createDeviceKeyProvider } from "@/lib/local-cache";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
});

describe("encrypted local cache", () => {
  it("encrypts values before storing and decrypts them on read", async () => {
    const store = createMemoryBlobStore();
    const cache = createEncryptedLocalCache(store, createDeviceKeyProvider());
    await cache.put("document-1", { total: 1200, billed_to: "Sensitive" });
    expect(await store.get("document-1")).not.toContain("Sensitive");
    await expect(cache.get("document-1")).resolves.toEqual({ total: 1200, billed_to: "Sensitive" });
  });

  it("rejects a tampered cache record and clears all records", async () => {
    const store = createMemoryBlobStore();
    const cache = createEncryptedLocalCache(store, createDeviceKeyProvider());
    await cache.put("document-1", { total: 1200 });
    const envelope = JSON.parse((await store.get("document-1")) ?? "{}");
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`;
    await store.set("document-1", JSON.stringify(envelope));
    await expect(cache.get("document-1")).rejects.toThrow();
    await cache.clear();
    await expect(store.get("document-1")).resolves.toBeNull();
  });
});
