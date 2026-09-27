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

test("ciphertext document migration has no plaintext business columns", () => {
  const source = readFileSync("supabase/migrations/000003_09272026-2028_encrypted_documents.sql", "utf8");
  assert.doesNotMatch(source, /billed_to|items_json|ack_details|total/);
  assert.match(source, /encrypted_payload/);
});
