import { writeFile } from "node:fs/promises";
import type { Dialog } from "electron";
import type { DocumentDatabase, DocumentInput, StoredDocument } from "./document-database.js";
import type { MigrationResult } from "./legacy-migration.js";

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

type IpcMainPort = {
  handle(channel: string, listener: IpcHandler): void;
};

type DialogPort = Pick<Dialog, "showOpenDialog">;
type SaveDialogPort = Pick<Dialog, "showSaveDialog">;

type DocumentDatabasePort = Pick<DocumentDatabase, "save" | "get" | "update" | "list" | "delete" | "importLegacyFile">;

export const ipcChannels = [
  "documents:save",
  "documents:get",
  "documents:update",
  "documents:list",
  "documents:delete",
  "files:save-pdf",
  "migration:scan",
  "migration:import-file",
] as const;

export type IpcDependencies = {
  database: DocumentDatabasePort;
  dialog: DialogPort & SaveDialogPort;
  ipcMain: IpcMainPort;
  localAppData: string;
  scanChromiumProfiles(localAppData: string, database: DocumentDatabasePort): Promise<MigrationResult[]>;
};

function positiveInteger(value: unknown): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value <= 0) {
    throw new Error("Document ID must be a positive integer.");
  }
  return value;
}

function documentInput(value: unknown): DocumentInput {
  if (!value || typeof value !== "object") throw new Error("Document data is required.");
  const input = value as Record<string, unknown>;
  const stringFields = [
    "doc_type",
    "doc_date",
    "billed_to",
    "unit",
    "driver",
    "requestor",
    "items_json",
    "ack_ref_no",
    "ack_details",
    "ack_received_by",
    "ack_date_received",
  ] as const;
  if (
    stringFields.some((field) => typeof input[field] !== "string") ||
    typeof input.total !== "number" ||
    typeof input.ack_amount !== "number"
  ) {
    throw new Error("Document data is invalid.");
  }
  if (input.doc_type !== "billing" && input.doc_type !== "quotation" && input.doc_type !== "acknowledgement") {
    throw new Error("Document type is invalid.");
  }
  return input as unknown as DocumentInput;
}

function manualImportCancelled(): MigrationResult {
  return { source: "Manual backup", importedCount: 0, message: "No backup file was selected." };
}

function pdfSaveInput(value: unknown): { defaultFileName: string; bytes: Uint8Array } {
  if (!value || typeof value !== "object") {
    throw new Error("PDF save input is required.");
  }
  const input = value as Record<string, unknown>;
  if (typeof input.defaultFileName !== "string" || !(input.bytes instanceof Uint8Array)) {
    throw new Error("PDF save input is invalid.");
  }
  return { defaultFileName: input.defaultFileName, bytes: input.bytes };
}

export function registerIpcHandlers({ database, dialog, ipcMain, localAppData, scanChromiumProfiles }: IpcDependencies) {
  ipcMain.handle("documents:save", (_event, input) => database.save(documentInput(input)));
  ipcMain.handle("documents:get", (_event, id) => database.get(positiveInteger(id)) as StoredDocument | undefined);
  ipcMain.handle("documents:update", (_event, id, input) => database.update(positiveInteger(id), documentInput(input)));
  ipcMain.handle("documents:list", () => database.list());
  ipcMain.handle("documents:delete", (_event, id) => database.delete(positiveInteger(id)));
  ipcMain.handle("files:save-pdf", async (_event, input) => {
    const { defaultFileName, bytes } = pdfSaveInput(input);
    const selection = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    if (selection.canceled || !selection.filePath) {
      return { canceled: true };
    }
    await writeFile(selection.filePath, bytes);
    return { canceled: false, filePath: selection.filePath };
  });
  ipcMain.handle("migration:scan", () => scanChromiumProfiles(localAppData, database));
  ipcMain.handle("migration:import-file", async () => {
    const selection = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "SQLite database", extensions: ["sqlite", "db"] }],
    });
    const file = selection.filePaths[0];
    if (selection.canceled || !file) return manualImportCancelled();
    const importedCount = database.importLegacyFile(file);
    return { source: file, importedCount, message: `Imported ${importedCount} document(s).` };
  });
}
