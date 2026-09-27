import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("document and sync functions use caller-scoped clients, not the service role", () => {
  for (const file of ["supabase/functions/documents/index.ts", "supabase/functions/sync/index.ts", "supabase/functions/workspace-context/index.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /SUPABASE_ANON_KEY/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test("browser preflight reaches functions that authenticate inside the handler", () => {
  const source = readFileSync("supabase/config.toml", "utf8");
  assert.match(source, /\[functions\.documents\][\s\S]*?verify_jwt = false/);
  assert.match(source, /\[functions\.sync\][\s\S]*?verify_jwt = false/);
  assert.match(source, /\[functions\.workspace-context\][\s\S]*?verify_jwt = false/);
  assert.match(source, /\[functions\.members\][\s\S]*?verify_jwt = false/);
});

test("function entrypoints handle preflight before constructing authenticated clients", () => {
  for (const file of [
    "supabase/functions/documents/index.ts",
    "supabase/functions/sync/index.ts",
    "supabase/functions/workspace-context/index.ts",
    "supabase/functions/members/index.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    const optionsIndex = source.indexOf('if (request.method === "OPTIONS") return handleOptions(request);');
    const clientIndex = source.indexOf("createClient(");
    assert.ok(optionsIndex >= 0 && optionsIndex < clientIndex, `${file} must short-circuit OPTIONS before createClient`);
  }
});

test("ciphertext document migration has no plaintext business columns", () => {
  const source = readFileSync("supabase/migrations/000003_09272026-2028_encrypted_documents.sql", "utf8");
  assert.doesNotMatch(source, /billed_to|items_json|ack_details|total/);
  assert.match(source, /encrypted_payload/);
});
