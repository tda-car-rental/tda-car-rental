import { afterEach, describe, expect, it } from "vitest";

const bridge = {
  documents: {
    save: async () => 1,
    get: async () => undefined,
    update: async () => undefined,
    list: async () => [],
    delete: async () => undefined,
  },
  migration: {
    scanChromium: async () => [],
    importFile: async () => ({ source: "manual", importedCount: 0, message: "" }),
  },
};

afterEach(() => {
  Reflect.deleteProperty(window, "tda");
});

describe("electronApi", () => {
  it("returns the context-isolated Electron bridge", async () => {
    Object.defineProperty(window, "tda", { configurable: true, value: bridge });
    const modulePath = "@/lib/electron-api";
    const module = await import(modulePath).catch(() => undefined);

    expect(module?.electronApi).toBeTypeOf("function");
    if (!module) return;
    expect(module.electronApi()).toBe(bridge);
  });

  it("explains when Electron is running without the preload bridge", async () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: `${originalUserAgent} Electron/43.2.0`,
    });
    const modulePath = "@/lib/electron-api";
    const module = await import(modulePath).catch(() => undefined);

    expect(module?.electronApi).toBeTypeOf("function");
    if (!module) return;
    expect(() => module.electronApi()).toThrowError(
      "TDA Car Rental is running in Electron, but the desktop bridge is unavailable. Restart the desktop app so the preload script can attach.",
    );
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
  });
});
