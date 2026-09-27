import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { decodeKeyMaterial } from "../_shared/crypto.ts";
import { createDocumentsHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const authorization = request.headers.get("authorization") ?? "";
  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const handler = createDocumentsHandler({
    authClient: client,
    dbClient: client,
    keyMaterial: decodeKeyMaterial(Deno.env.get("DOCUMENT_ENCRYPTION_KEY") ?? ""),
    keyVersion: Number(Deno.env.get("DOCUMENT_ENCRYPTION_KEY_VERSION") ?? "1"),
  });
  return handler(request);
});
