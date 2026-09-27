import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { MigrationRunner, type Migration } from "./database-migration.js";

export type DocumentType = "billing" | "quotation" | "acknowledgement";

export type DocumentInput = {
  doc_type: DocumentType;
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

export type StoredDocument = DocumentInput & {
  id: number;
  created_at: string;
};

const documentColumns = `
  id,
  doc_type,
  doc_date,
  billed_to,
  unit,
  driver,
  requestor,
  total,
  items_json,
  ack_ref_no,
  ack_amount,
  ack_details,
  ack_received_by,
  ack_date_received,
  created_at
`;

const legacyDocumentColumns = [
  "doc_type",
  "doc_date",
  "billed_to",
  "unit",
  "driver",
  "requestor",
  "total",
  "items_json",
  "created_at",
];

function ensureColumn(database: DatabaseSync, name: string, definition: string) {
  const columns = database.prepare("PRAGMA table_info(docs)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === name)) return;
  database.exec(`ALTER TABLE docs ADD COLUMN ${name} ${definition}`);
}

export class DocumentDatabase {
  private readonly database: DatabaseSync;
  private readonly runner: MigrationRunner;

  constructor(file: string) {
    this.database = new DatabaseSync(file);
    this.runner = new MigrationRunner(this.database);

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS docs (
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

    this.runner.run([
      {
        version: 1,
        name: "add-acknowledgement-columns",
        up(db) {
          ensureColumn(db, "ack_ref_no", "TEXT DEFAULT ''");
          ensureColumn(db, "ack_amount", "REAL DEFAULT 0");
          ensureColumn(db, "ack_details", "TEXT DEFAULT ''");
          ensureColumn(db, "ack_received_by", "TEXT DEFAULT ''");
          ensureColumn(db, "ack_date_received", "TEXT DEFAULT ''");
        },
      },
    ]);
  }

  save(input: DocumentInput): number {
    const result = this.database
      .prepare(
        `
      INSERT INTO docs (doc_type, doc_date, billed_to, unit, driver, requestor, total, items_json, ack_ref_no, ack_amount, ack_details, ack_received_by, ack_date_received)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        input.doc_type,
        input.doc_date,
        input.billed_to,
        input.unit,
        input.driver,
        input.requestor,
        input.total,
        input.items_json,
        input.ack_ref_no,
        input.ack_amount,
        input.ack_details,
        input.ack_received_by,
        input.ack_date_received,
      );
    return Number(result.lastInsertRowid);
  }

  get(id: number): StoredDocument | undefined {
    return this.database
      .prepare(`SELECT ${documentColumns} FROM docs WHERE id = ? LIMIT 1`)
      .get(id) as StoredDocument | undefined;
  }

  update(id: number, input: DocumentInput): void {
    this.database
      .prepare(
        `
      UPDATE docs
      SET doc_type = ?, doc_date = ?, billed_to = ?, unit = ?, driver = ?, requestor = ?, total = ?, items_json = ?, ack_ref_no = ?, ack_amount = ?, ack_details = ?, ack_received_by = ?, ack_date_received = ?
      WHERE id = ?
    `,
      )
      .run(
        input.doc_type,
        input.doc_date,
        input.billed_to,
        input.unit,
        input.driver,
        input.requestor,
        input.total,
        input.items_json,
        input.ack_ref_no,
        input.ack_amount,
        input.ack_details,
        input.ack_received_by,
        input.ack_date_received,
        id,
      );
  }

  list(): StoredDocument[] {
    return this.database
      .prepare(`SELECT ${documentColumns} FROM docs ORDER BY id DESC`)
      .all() as StoredDocument[];
  }

  delete(id: number): void {
    this.database.prepare("DELETE FROM docs WHERE id = ?").run(id);
  }

  importLegacyFile(file: string): number {
    const header = readFileSync(file).subarray(0, 16);
    if (!header.equals(Buffer.from("SQLite format 3\0"))) {
      throw new Error("Legacy import requires a SQLite database file.");
    }

    const legacy = new DatabaseSync(file, { readOnly: true });
    try {
      const legacyColumns = legacy.prepare("PRAGMA table_info(docs)").all() as Array<{
        name: string;
      }>;
      const names = new Set(legacyColumns.map((column) => column.name));
      if (!legacyColumns.length || legacyDocumentColumns.some((column) => !names.has(column))) {
        throw new Error("Legacy database does not contain a compatible docs table.");
      }

      const documents = legacy
        .prepare(`SELECT ${legacyDocumentColumns.join(", ")} FROM docs ORDER BY id ASC`)
        .all() as Array<DocumentInput & { created_at: string }>;
      const insert = this.database.prepare(`
        INSERT INTO docs (doc_type, doc_date, billed_to, unit, driver, requestor, total, items_json, ack_ref_no, ack_amount, ack_details, ack_received_by, ack_date_received, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      let transactionStarted = false;
      try {
        this.database.exec("BEGIN IMMEDIATE");
        transactionStarted = true;
        for (const document of documents) {
          insert.run(
            document.doc_type,
            document.doc_date,
            document.billed_to,
            document.unit,
            document.driver,
            document.requestor,
            document.total,
            document.items_json,
            "",
            0,
            "",
            "",
            "",
            document.created_at,
          );
        }
        this.database.exec("COMMIT");
        transactionStarted = false;
        return documents.length;
      } catch (error) {
        if (transactionStarted) this.database.exec("ROLLBACK");
        throw error;
      }
    } finally {
      legacy.close();
    }
  }

  close(): void {
    this.database.close();
  }
}
