import type { CloudApiError } from "./cloud-api";
import type { CloudDocument, CloudDocumentInput } from "./cloud-types";
import type { DocRow, DocumentInput } from "./db";
import { createSyncEngine, type SyncQueueCache } from "./sync-engine";

type DocumentApi = {
  listDocuments(input: { workspaceId: string; limit?: number }): Promise<{ documents: CloudDocument[]; nextCursor: unknown }>;
  getDocument(workspaceId: string, id: string): Promise<{ document: CloudDocument }>;
  saveDocument(workspaceId: string, body: Record<string, unknown>): Promise<{ document: CloudDocument }>;
  deleteDocument(workspaceId: string, body: Record<string, unknown>): Promise<{ document: CloudDocument }>;
  sync(workspaceId: string, mutation: Record<string, unknown>): Promise<unknown>;
};

const DOCUMENTS_KEY = "cached-documents";

function toRow(document: CloudDocument): DocRow {
  return document as unknown as DocRow;
}

function toInput(document: DocumentInput): CloudDocumentInput {
  return document as CloudDocumentInput;
}

function optimisticDocument(input: DocumentInput, id: string): CloudDocument {
  const now = new Date().toISOString();
  return { ...toInput(input), id, workspace_id: "offline", revision: 1, created_at: now, updated_at: now };
}

export function createCloudDocumentStore(options: {
  api: DocumentApi;
  workspaceId: string;
  cache: SyncQueueCache;
  createMutationId?: () => string;
}) {
  const sync = createSyncEngine({
    cache: options.cache,
    api: options.api,
    workspaceId: options.workspaceId,
    createMutationId: options.createMutationId,
  });

  async function cached(): Promise<CloudDocument[]> {
    return (await options.cache.get<CloudDocument[]>(DOCUMENTS_KEY)) ?? [];
  }

  async function cacheDocuments(documents: CloudDocument[]): Promise<void> {
    await options.cache.put(DOCUMENTS_KEY, documents);
  }

  async function merge(document: CloudDocument): Promise<void> {
    const documents = await cached();
    const existing = documents.findIndex((item) => item.id === document.id);
    if (existing === -1) documents.unshift(document);
    else documents[existing] = document;
    await cacheDocuments(documents);
  }

  return {
    async list(): Promise<DocRow[]> {
      try {
        const page = await options.api.listDocuments({ workspaceId: options.workspaceId, limit: 250 });
        await cacheDocuments(page.documents);
        return page.documents.filter((document) => document.doc_type !== "contract").map(toRow);
      } catch (error) {
        if ((error as CloudApiError)?.code === "UNAUTHENTICATED") throw error;
        return (await cached()).map(toRow);
      }
    },
    async get(id: string | number): Promise<DocRow | undefined> {
      const documentId = String(id);
      try {
        const result = await options.api.getDocument(options.workspaceId, documentId);
        await merge(result.document);
        return toRow(result.document);
      } catch {
        const document = (await cached()).find((item) => item.id === documentId);
        return document ? toRow(document) : undefined;
      }
    },
    async save(input: DocumentInput): Promise<string> {
      const mutationId = options.createMutationId?.() ?? crypto.randomUUID();
      try {
        const result = await options.api.saveDocument(options.workspaceId, { operation: "create", mutationId, document: toInput(input) });
        await merge(result.document);
        return result.document.id;
      } catch {
        const document = optimisticDocument(input, crypto.randomUUID());
        await merge(document);
        await sync.enqueue({ operation: "create", mutationId, document: toInput(input) });
        return document.id;
      }
    },
    async update(id: string | number, input: DocumentInput): Promise<void> {
      const existing = await this.get(id);
      const mutationId = options.createMutationId?.() ?? crypto.randomUUID();
      try {
        const result = await options.api.saveDocument(options.workspaceId, {
          operation: "update", mutationId, id: String(id), expectedRevision: existing?.revision ?? 1, document: toInput(input),
        });
        await merge(result.document);
      } catch {
        await sync.enqueue({ operation: "update", mutationId, id: String(id), expectedRevision: existing?.revision ?? 1, document: toInput(input) });
      }
    },
    async delete(id: string | number): Promise<void> {
      const existing = await this.get(id);
      const mutationId = options.createMutationId?.() ?? crypto.randomUUID();
      try {
        const result = await options.api.deleteDocument(options.workspaceId, {
          mutationId, id: String(id), expectedRevision: existing?.revision ?? 1,
        });
        await merge(result.document);
      } catch {
        await sync.enqueue({ operation: "delete", mutationId, id: String(id), expectedRevision: existing?.revision ?? 1 });
      }
    },
    sync,
  };
}
