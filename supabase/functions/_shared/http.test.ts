import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, handleOptions, jsonResponse, readJson } from "./http.ts";

test("OPTIONS returns allowlisted CORS headers", () => {
  process.env.ALLOWED_ORIGINS = "https://app.example";
  const response = handleOptions(new Request("https://edge.example", { method: "OPTIONS", headers: { Origin: "https://app.example" } }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://app.example");
});

test("readJson rejects non-JSON and oversized requests", async () => {
  await assert.rejects(
    () => readJson(new Request("https://edge.example", { method: "POST", body: "{}" })),
    (error: unknown) => error instanceof ApiError && error.code === "UNSUPPORTED_MEDIA_TYPE",
  );
  await assert.rejects(
    () =>
      readJson(
        new Request("https://edge.example", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: "x".repeat(20) }),
        }),
        10,
      ),
    (error: unknown) => error instanceof ApiError && error.code === "REQUEST_TOO_LARGE",
  );
});

test("jsonResponse never returns stack traces for API errors", async () => {
  const response = jsonResponse(new ApiError("FORBIDDEN", "Access denied.", 403), new Request("https://edge.example"));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: { code: "FORBIDDEN", message: "Access denied." } });
});
