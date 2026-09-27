import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { handleOptions } from "../_shared/http.ts";
import { createWorkspaceContextHandler } from "./handler.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleOptions(request);
  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return createWorkspaceContextHandler({ authClient: client, dbClient: client })(request);
});
