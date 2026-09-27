import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DocumentDatabase } from "@/electron/main/document-database";

describe("DocumentDatabase device key persistence", () => {
  it("stores and clears the protected key envelope separately from documents", () => {
    const directory = mkdtempSync(join(tmpdir(), "tda-device-key-"));
    const database = new DocumentDatabase(join(directory, "documents.sqlite"));
    try {
      database.setDeviceKey("os-protected-value");
      expect(database.getDeviceKey()).toBe("os-protected-value");
      database.clearDeviceKey();
      expect(database.getDeviceKey()).toBeNull();
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
