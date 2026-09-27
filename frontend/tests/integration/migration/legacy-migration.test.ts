// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentDatabase } from "@/electron/main/document-database";

type ImportableDatabase = DocumentDatabase & {
  importLegacyFile(file: string): number;
};

const tempDirectories: string[] = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "tda-legacy-db-"));
  tempDirectories.push(directory);
  return directory;
}

function createLegacyDatabase(file: string) {
  const database = new DatabaseSync(file);
  database.exec(`
    CREATE TABLE docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_type TEXT NOT NULL,
      doc_date TEXT NOT NULL,
      billed_to TEXT,
      unit TEXT,
      driver TEXT,
      requestor TEXT,
      total REAL,
      items_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  database.prepare(`
    INSERT INTO docs (doc_type, doc_date, billed_to, unit, driver, requestor, total, items_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("billing", "2026-07-26", "Path Foundation", "Toyota HiAce", "Teddy Dimate", "", 1200, "[]");
  database.prepare(`
    INSERT INTO docs (doc_type, doc_date, billed_to, unit, driver, requestor, total, items_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("quotation", "2026-07-27", "", "Toyota Commuter", "", "A. Cruz", 900, "[]");
  database.close();
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("legacy migration", () => {
  it("imports a compatible legacy SQLite database transactionally", () => {
    const directory = temporaryDirectory();
    const legacyFile = join(directory, "legacy.sqlite");
    createLegacyDatabase(legacyFile);
    const target = new DocumentDatabase(join(directory, "target.sqlite")) as ImportableDatabase;

    try {
      expect(target.importLegacyFile(legacyFile)).toBe(2);
      expect(target.list()).toMatchObject([
        { doc_type: "quotation", requestor: "A. Cruz" },
        { doc_type: "billing", billed_to: "Path Foundation" },
      ]);
    } finally {
      target.close();
    }
  });

  it("leaves the target unchanged when the legacy file is invalid", () => {
    const directory = temporaryDirectory();
    const target = new DocumentDatabase(join(directory, "target.sqlite")) as ImportableDatabase;
    const invalidFile = join(directory, "invalid.sqlite");
    new DatabaseSync(invalidFile).close();

    try {
      expect(() => target.importLegacyFile(invalidFile)).toThrow(/SQLite|docs table/i);
      expect(target.list()).toEqual([]);
    } finally {
      target.close();
    }
  });

  it("extracts only the legacy key's base64 SQLite payload from LevelDB entries", async () => {
    const modulePath = "@/electron/main/legacy-migration";
    const module = await import(modulePath).catch(() => undefined);

    expect(module?.extractLegacyPayload).toBeTypeOf("function");
    if (!module) return;
    expect(module.extractLegacyPayload([
      [Buffer.from("unrelated"), Buffer.from("ignored")],
      [Buffer.from("origin\u0000tda_quotation_db_v1"), Buffer.from("c3FsaXRl")],
    ])).toBe("c3FsaXRl");
  });
});
