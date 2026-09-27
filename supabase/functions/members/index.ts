import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createMembersHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const callerClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const adminClient = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return createMembersHandler({ authClient: callerClient, dbClient: callerClient, adminAuth: adminClient.auth.admin })(request);
});
