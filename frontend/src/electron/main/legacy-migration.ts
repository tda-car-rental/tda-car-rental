import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClassicLevel } from "classic-level";
import { DocumentDatabase } from "./document-database.js";

const legacyStorageKey = "tda_quotation_db_v1";
const sqliteHeader = Buffer.from("SQLite format 3\0");

export type MigrationResult = {
  source: string;
  importedCount: number;
  message: string;
};

function entryText(value: Buffer | string) {
  return Buffer.isBuffer(value) ? value.toString("utf8") : value;
}

export function extractLegacyPayload(entries: Iterable<readonly [Buffer | string, Buffer | string]>): string | undefined {
  for (const [key, value] of entries) {
    if (!entryText(key).includes(legacyStorageKey)) continue;
    const text = entryText(value);
    const payload = text.match(/[A-Za-z0-9+/]{16,}={0,2}/)?.[0];
    return payload ?? text.trim();
  }
  return undefined;
}

function chromiumRoots(localAppData: string) {
  return [
    join(localAppData, "Google", "Chrome", "User Data"),
    join(localAppData, "Microsoft", "Edge", "User Data"),
    join(localAppData, "BraveSoftware", "Brave-Browser", "User Data"),
  ];
}

async function profileDirectories(root: string) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && (entry.name === "Default" || entry.name.startsWith("Profile ")))
    .map((entry) => join(root, entry.name));
}

export async function scanChromiumProfiles(localAppData: string, database: DocumentDatabase): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const root of chromiumRoots(localAppData)) {
    for (const profile of await profileDirectories(root)) {
      const source = join(profile, "Local Storage", "leveldb");
      if (!existsSync(source)) continue;
      const scratch = await mkdtemp(join(tmpdir(), "tda-browser-import-"));
      const copiedLevelDb = join(scratch, "leveldb");
      let level: ClassicLevel<Buffer, Buffer> | undefined;
      try {
        await cp(source, copiedLevelDb, { force: true, recursive: true });
        level = new ClassicLevel<Buffer, Buffer>(copiedLevelDb, { keyEncoding: "buffer", valueEncoding: "buffer" });
        await level.open();
        const entries: Array<[Buffer, Buffer]> = [];
        for await (const entry of level.iterator()) entries.push(entry);
        const payload = extractLegacyPayload(entries);
        if (!payload) {
          results.push({ source: profile, importedCount: 0, message: "No TDA legacy data found." });
          continue;
        }

        const legacyFile = join(scratch, "legacy.sqlite");
        const bytes = Buffer.from(payload, "base64");
        if (!bytes.subarray(0, sqliteHeader.length).equals(sqliteHeader)) {
          results.push({ source: profile, importedCount: 0, message: "Legacy data was not a compatible SQLite database." });
          continue;
        }
        await writeFile(legacyFile, bytes);
        const importedCount = database.importLegacyFile(legacyFile);
        results.push({ source: profile, importedCount, message: `Imported ${importedCount} document(s).` });
      } catch (error) {
        results.push({
          source: profile,
          importedCount: 0,
          message: error instanceof Error ? `Could not read profile: ${error.message}` : "Could not read profile.",
        });
      } finally {
        await level?.close().catch(() => undefined);
        await rm(scratch, { force: true, recursive: true });
      }
    }
  }

  return results.length ? results : [{ source: "Chromium profiles", importedCount: 0, message: "No supported browser profile was found." }];
}
