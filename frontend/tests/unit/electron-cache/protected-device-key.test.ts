import { describe, expect, it } from "vitest";
import { createProtectedDeviceKeyStore } from "@/electron/main/protected-device-key";

function createFakeSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value, "utf8").reverse(),
    decryptString: (value: Buffer) => Buffer.from(value).reverse().toString("utf8"),
  };
}

describe("protected Electron device key", () => {
  it("creates a stable 256-bit key while storing only an OS-protected value", async () => {
    let stored: string | null = null;
    const safeStorage = createFakeSafeStorage();
    const store = createProtectedDeviceKeyStore(
      {
        get: () => stored,
        set: (value) => {
          stored = value;
        },
        clear: () => {
          stored = null;
        },
      },
      safeStorage,
      () => new Uint8Array(32).fill(7),
    );

    const first = await store.getOrCreate();
    const second = await store.getOrCreate();

    expect(first).toEqual(second);
    expect(first).toHaveLength(32);
    expect(stored).not.toContain("777777");
  });

  it("clears the protected key on sign out", async () => {
    let stored: string | null = null;
    const store = createProtectedDeviceKeyStore(
      {
        get: () => stored,
        set: (value) => {
          stored = value;
        },
        clear: () => {
          stored = null;
        },
      },
      createFakeSafeStorage(),
      () => new Uint8Array(32).fill(3),
    );

    await store.getOrCreate();
    store.clear();

    expect(stored).toBeNull();
  });
});
