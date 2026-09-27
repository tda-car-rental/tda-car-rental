// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirectories: string[] = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "tda-electron-storage-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("storage path", () => {
  it("uses the branded Electron profile directory", async () => {
    const module = await import("@/electron/main/storage-path").catch(() => undefined);

    expect(module?.resolveDocumentDatabasePath).toBeTypeOf("function");
    if (!module) return;

    const appDataRoot = temporaryDirectory();
    const file = module.resolveDocumentDatabasePath({ appDataRoot });

    expect(file).toBe(join(appDataRoot, "TDA Car Rental", "tda-car-rental.sqlite"));
  });

  it("moves the legacy database into the branded directory once", async () => {
    const module = await import("@/electron/main/storage-path").catch(() => undefined);

    expect(module?.ensurePersistentDocumentDatabase).toBeTypeOf("function");
    if (!module) return;

    const appDataRoot = temporaryDirectory();
    const legacyDirectory = join(appDataRoot, "tanstack_start_ts");
    const legacyFile = join(legacyDirectory, "tda-car-rental.sqlite");
    mkdirSync(legacyDirectory, { recursive: true });
    writeFileSync(legacyFile, "legacy");

    const file = module.ensurePersistentDocumentDatabase({ appDataRoot });

    expect(file).toBe(join(appDataRoot, "TDA Car Rental", "tda-car-rental.sqlite"));
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toBe("legacy");
    expect(existsSync(legacyFile)).toBe(false);
  });

  it("keeps the branded database when both files exist", async () => {
    const module = await import("@/electron/main/storage-path").catch(() => undefined);

    expect(module?.ensurePersistentDocumentDatabase).toBeTypeOf("function");
    if (!module) return;

    const appDataRoot = temporaryDirectory();
    const legacyDirectory = join(appDataRoot, "tanstack_start_ts");
    const brandedDirectory = join(appDataRoot, "TDA Car Rental");
    const legacyFile = join(legacyDirectory, "tda-car-rental.sqlite");
    const brandedFile = join(brandedDirectory, "tda-car-rental.sqlite");
    mkdirSync(legacyDirectory, { recursive: true });
    mkdirSync(brandedDirectory, { recursive: true });
    writeFileSync(legacyFile, "legacy");
    writeFileSync(brandedFile, "current");

    const file = module.ensurePersistentDocumentDatabase({ appDataRoot });

    expect(file).toBe(brandedFile);
    expect(readFileSync(brandedFile, "utf8")).toBe("current");
    expect(readFileSync(legacyFile, "utf8")).toBe("legacy");
  });
});
