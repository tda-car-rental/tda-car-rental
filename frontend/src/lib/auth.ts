import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfig } from "./config";

export type AuthUser = { id: string; email?: string };
export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: AuthUser; accessToken: string }
  | { status: "offline-authenticated"; user?: AuthUser }
  | { status: "error"; message: string };

type AuthClient = {
  auth: {
    getSession(): Promise<{ data: { session: { user?: AuthUser; access_token: string } | null }; error: unknown }>;
    signInWithPassword?(input: { email: string; password: string }): Promise<{ data: { user: AuthUser | null; session: { access_token: string } | null }; error: { message: string } | null }>;
    signOut?(): Promise<{ error: unknown }>;
    onAuthStateChange?(callback: (_event: string, session: { user?: AuthUser; access_token: string } | null) => void): { data: { subscription: { unsubscribe(): void } } };
  };
};

type AuthControllerOptions = {
  client: AuthClient;
  hasCachedSession?: () => Promise<boolean>;
  clearSensitiveState?: () => void | Promise<void>;
};

export function createSupabaseAuthClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

function stateFromSession(session: { user?: AuthUser; access_token: string } | null): AuthState {
  return session?.access_token && session.user
    ? { status: "signed-in", user: session.user, accessToken: session.access_token }
    : { status: "signed-out" };
}

export function createAuthController(options: AuthControllerOptions) {
  let state: AuthState = { status: "loading" };
  const listeners = new Set<(next: AuthState) => void>();
  let subscription: { unsubscribe(): void } | undefined;

  function setState(next: AuthState) {
    state = next;
    for (const listener of listeners) listener(next);
  }

  return {
    getState: () => state,
    subscribe(listener: (next: AuthState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      if (options.client.auth.onAuthStateChange) {
        const result = options.client.auth.onAuthStateChange((_event, session) => setState(stateFromSession(session)));
        subscription = result.data.subscription;
      }
      try {
        const result = await options.client.auth.getSession();
        if (result.error) throw result.error;
        setState(stateFromSession(result.data.session));
      } catch {
        const cached = await options.hasCachedSession?.();
        setState(cached ? { status: "offline-authenticated" } : { status: "signed-out" });
      }
    },
    async signIn(email: string, password: string) {
      if (!options.client.auth.signInWithPassword) throw new Error("Authentication is unavailable.");
      const result = await options.client.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.user || !result.data.session) {
        const message = result.error?.message ?? "Sign-in failed.";
        setState({ status: "error", message: "Sign-in failed." });
        throw new Error(message);
      }
      setState({ status: "signed-in", user: result.data.user, accessToken: result.data.session.access_token });
    },
    async signOut() {
      await options.client.auth.signOut?.();
      await options.clearSensitiveState?.();
      setState({ status: "signed-out" });
      subscription?.unsubscribe();
      subscription = undefined;
    },
    async getAccessToken() {
      const current = state;
      return current.status === "signed-in" ? current.accessToken : null;
    },
  };
}
