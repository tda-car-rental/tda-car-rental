// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DatabaseSync } from "node:sqlite";

type DocumentInput = {
  doc_type: "billing" | "quotation" | "acknowledgement";
  doc_date: string;
  billed_to: string;
  unit: string;
  driver: string;
  requestor: string;
  total: number;
  items_json: string;
  ack_ref_no: string;
  ack_amount: number;
  ack_details: string;
  ack_received_by: string;
  ack_date_received: string;
};

type DatabaseContract = {
  save(input: DocumentInput): number;
  get(id: number): { id: number; billed_to: string; items_json: string } | undefined;
  update(id: number, input: DocumentInput): void;
  list(): Array<{ id: number; billed_to: string }>;
  delete(id: number): void;
  close(): void;
};

type DatabaseModule = {
  DocumentDatabase: new (file: string) => DatabaseContract;
};

const tempDirectories: string[] = [];
const documentInput: DocumentInput = {
  doc_type: "billing",
  doc_date: "2026-07-26",
  billed_to: "Path Foundation",
  unit: "Toyota HiAce",
  driver: "Teddy Dimate",
  requestor: "",
  total: 1200,
  items_json: JSON.stringify([
    {
      date: "2026-07-26",
      unit: "Toyota HiAce",
      destination: "Subic",
      passenger: "A. Cruz",
      amount: 1200,
    },
  ]),
  ack_ref_no: "",
  ack_amount: 0,
  ack_details: "",
  ack_received_by: "",
  ack_date_received: "",
};

function temporaryDatabaseFile() {
  const directory = mkdtempSync(join(tmpdir(), "tda-electron-db-"));
  tempDirectories.push(directory);
  return join(directory, "tda-car-rental.sqlite");
}

async function loadDatabaseModule() {
  const modulePath = "@/electron/main/document-database";
  const module = await import(modulePath).catch(() => undefined);
  expect(module?.DocumentDatabase).toBeTypeOf("function");
  return module as DatabaseModule | undefined;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("DocumentDatabase", () => {
  it("persists document CRUD in a native SQLite file", async () => {
    const module = await loadDatabaseModule();
    if (!module) return;

    const file = temporaryDatabaseFile();
    const database = new module.DocumentDatabase(file);
    const id = database.save(documentInput);

    expect(database.get(id)).toMatchObject({
      id,
      billed_to: "Path Foundation",
      items_json: documentInput.items_json,
    });
    database.update(id, { ...documentInput, billed_to: "Updated client" });
    expect(database.list()).toMatchObject([{ id, billed_to: "Updated client" }]);
    database.close();

    const reopened = new module.DocumentDatabase(file);
    expect(reopened.get(id)).toMatchObject({ id, billed_to: "Updated client" });
    reopened.delete(id);
    expect(reopened.list()).toEqual([]);
    reopened.close();
  });

  it("persists acknowledgement receipt data", async () => {
    const module = await loadDatabaseModule();
    if (!module) return;

    const file = temporaryDatabaseFile();
    const database = new module.DocumentDatabase(file);
    const id = database.save({
      ...documentInput,
      doc_type: "acknowledgement",
      doc_date: "26-Jul-26",
      total: 5000,
      ack_ref_no: "004",
      ack_amount: 5000,
      ack_details: "July 25, 2026 Easy Park office to Park Inn Hotel, Clark",
      ack_received_by: "Easy Park Office - SBFZ",
      ack_date_received: "26-Jul-26",
    });

    expect(database.get(id)).toMatchObject({
      id,
      doc_type: "acknowledgement",
      ack_ref_no: "004",
      ack_amount: 5000,
      ack_received_by: "Easy Park Office - SBFZ",
    });

    database.close();
  });

  it("adds missing acknowledgement columns on open", async () => {
    const module = await loadDatabaseModule();
    if (!module) return;

    const file = temporaryDatabaseFile();
    const legacy = new (DatabaseSync as new (path: string) => DatabaseSync)(file);
    legacy.exec(
      "CREATE TABLE docs (id INTEGER PRIMARY KEY AUTOINCREMENT, doc_type TEXT, doc_date TEXT, billed_to TEXT, unit TEXT, driver TEXT, requestor TEXT, total REAL, items_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
    );
    legacy.exec("INSERT INTO docs (doc_type) VALUES ('billing')");
    legacy.close();

    const database = new module.DocumentDatabase(file);
    const rows = database.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ doc_type: "billing", ack_ref_no: "", ack_amount: 0 });
    database.close();
  });
});
