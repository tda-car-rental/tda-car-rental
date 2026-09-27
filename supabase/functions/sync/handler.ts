import { ApiError, handleOptions, jsonResponse, readJson } from "../_shared/http.ts";

type SyncDependencies = {
  documentHandler: (request: Request) => Promise<Response>;
};

export function createSyncHandler(deps: SyncDependencies) {
  return async function handleSync(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return handleOptions(request);
    try {
      if (request.method === "GET") return deps.documentHandler(request);
      if (request.method !== "POST") throw new ApiError("VALIDATION_FAILED", "Method is not supported.", 405);
      const body = await readJson<{ mutations?: unknown }>(request);
      if (!Array.isArray(body.mutations) || body.mutations.length !== 1) {
        throw new ApiError("VALIDATION_FAILED", "One mutation is required.", 400);
      }
      const headers = new Headers(request.headers);
      headers.set("content-type", "application/json");
      return deps.documentHandler(new Request(request.url, { method: "POST", headers, body: JSON.stringify(body.mutations[0]) }));
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse(error, request);
      return jsonResponse(new ApiError("INTERNAL_ERROR", "Synchronization failed.", 500), request);
    }
  };
}
