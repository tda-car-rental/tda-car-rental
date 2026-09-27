import type { DocRow, DocumentInput } from "./db";

export type DocumentStore = {
  list(): Promise<DocRow[]>;
  get(id: string | number): Promise<DocRow | undefined>;
  save(input: DocumentInput): Promise<string | number>;
  update(id: string | number, input: DocumentInput): Promise<void>;
  delete(id: string | number): Promise<void>;
};

let activeStore: DocumentStore | null = null;

export function configureDocumentStore(store: DocumentStore): void {
  activeStore = store;
}

export function clearDocumentStore(): void {
  activeStore = null;
}

export function documentStore(): DocumentStore {
  if (!activeStore) throw new Error("Cloud document access is not ready.");
  return activeStore;
}
