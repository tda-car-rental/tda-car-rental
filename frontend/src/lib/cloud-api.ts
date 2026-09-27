import type {
  CloudDocument,
  CloudDocumentInput,
  CloudDocumentKind,
  DocumentCursor,
  DocumentPage,
  DocumentSummary,
  WorkspaceContext,
} from "./cloud-types";

export type CloudApiOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export class CloudApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CloudApiError";
  }
}

function queryValue(value: string | number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

export function createCloudApi(options: CloudApiOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init: RequestInit = {}, workspaceId?: string): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new CloudApiError("UNAUTHENTICATED", 401, "Authentication required.");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
    if (workspaceId) headers.set("x-workspace-id", workspaceId);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetchImpl(`${baseUrl}/${path.replace(/^\//, "")}`, { ...init, headers });
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | T | null;
    if (!response.ok) {
      const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
      throw new CloudApiError(error?.code ?? "INTERNAL_ERROR", response.status, error?.message ?? "Cloud operation failed.");
    }
    return payload as T;
  }

  return {
    listDocuments(input: { workspaceId: string; kind?: CloudDocumentKind; limit?: number; cursor?: DocumentCursor }): Promise<DocumentPage> {
      const params = new URLSearchParams();
      if (input.kind) params.set("kind", input.kind);
      if (input.limit !== undefined) params.set("limit", String(input.limit));
      if (input.cursor) params.set("cursor", btoa(JSON.stringify(input.cursor)));
      return request<DocumentPage>(`documents?${params.toString()}`, {}, input.workspaceId);
    },
    getDocument(workspaceId: string, id: string): Promise<{ document: CloudDocument }> {
      return request<{ document: CloudDocument }>(`documents/${encodeURIComponent(id)}`, {}, workspaceId);
    },
    saveDocument(workspaceId: string, body: Record<string, unknown>): Promise<{ document: CloudDocument }> {
      return request<{ document: CloudDocument }>("documents", { method: "POST", body: JSON.stringify(body) }, workspaceId);
    },
    deleteDocument(workspaceId: string, body: Record<string, unknown>): Promise<{ document: CloudDocument }> {
      return request<{ document: CloudDocument }>("documents", { method: "POST", body: JSON.stringify({ ...body, operation: "delete" }) }, workspaceId);
    },
    getWorkspaceContext(): Promise<WorkspaceContext> {
      return request<WorkspaceContext>("workspace-context");
    },
    getSummary(workspaceId: string, input: { kind?: CloudDocumentKind; months?: number } = {}): Promise<DocumentSummary> {
      const params = new URLSearchParams();
      if (input.kind) params.set("kind", input.kind);
      if (input.months !== undefined) params.set("months", queryValue(input.months) ?? "");
      return request<DocumentSummary>(`documents/summary?${params.toString()}`, {}, workspaceId);
    },
    sync(workspaceId: string, mutation: Record<string, unknown>): Promise<unknown> {
      return request("sync", { method: "POST", body: JSON.stringify({ mutations: [mutation] }) }, workspaceId);
    },
  };
}
