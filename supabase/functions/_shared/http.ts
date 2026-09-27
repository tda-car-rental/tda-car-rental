export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "REQUEST_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "NOT_FOUND"
  | "SYNC_RETRYABLE"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function configuredOrigins(): string[] {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env: { get(name: string): string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  const configured = runtime.Deno?.env.get("ALLOWED_ORIGINS") ?? runtime.process?.env?.ALLOWED_ORIGINS ?? "";
  return configured.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-mutation-id, x-workspace-id",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "cache-control": "no-store",
    vary: "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && configuredOrigins().includes(origin)) headers.set("access-control-allow-origin", origin);
  return headers;
}

export function handleOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function jsonResponse(value: unknown, request: Request, status = 200): Response {
  const isError = value instanceof ApiError;
  const body = isError
    ? { error: { code: value.code, message: value.message } }
    : value;
  const headers = corsHeaders(request);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status: isError ? value.status : status, headers });
}

export async function readJson<T>(request: Request, maxBytes = 256_000): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "JSON is required.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) {
    throw new ApiError("REQUEST_TOO_LARGE", "Request is too large.", 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiError("REQUEST_TOO_LARGE", "Request is too large.", 413);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Request body is invalid.", 400);
  }
}
