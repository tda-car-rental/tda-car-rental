// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

describe("device key IPC", () => {
  it("keeps OS-protected device key access behind the preload boundary", async () => {
    const module = await import("@/electron/main/ipc");
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const deviceKeyStore = {
      getOrCreate: vi.fn(async () => new Uint8Array([1, 2, 3])),
      clear: vi.fn(),
    };

    module.registerIpcHandlers({
      database: {
        save: vi.fn(), get: vi.fn(), update: vi.fn(), list: vi.fn(), delete: vi.fn(), importLegacyFile: vi.fn(),
      },
      deviceKeyStore,
      dialog: {
        showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
        showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined })),
      },
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
      localAppData: "C:/Users/Example/AppData/Local",
      scanChromiumProfiles: vi.fn(async () => []),
    });

    await expect(handlers.get("device-key:get")?.({})).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await handlers.get("device-key:clear")?.({});
    expect(deviceKeyStore.clear).toHaveBeenCalledOnce();
  });
});
