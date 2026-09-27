import type { DocRow } from "./db";

export type DocumentInput = Omit<DocRow, "id" | "created_at">;

export type MigrationResult = {
  source: string;
  importedCount: number;
  message: string;
};

export interface TdaElectronApi {
  documents: {
    save(input: DocumentInput): Promise<number>;
    get(id: number): Promise<DocRow | undefined>;
    update(id: number, input: DocumentInput): Promise<void>;
    list(): Promise<DocRow[]>;
    delete(id: number): Promise<void>;
  };
  files: {
    savePdf(input: { defaultFileName: string; bytes: Uint8Array }): Promise<{ canceled: boolean; filePath?: string }>;
  };
  migration: {
    scanChromium(): Promise<MigrationResult[]>;
    importFile(): Promise<MigrationResult>;
  };
  startup: {
    retry(): void;
    quit(): void;
  };
}

declare global {
  interface Window {
    tda: TdaElectronApi;
  }
}

export {};
