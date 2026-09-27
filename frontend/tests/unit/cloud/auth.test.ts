import { describe, expect, it, vi } from "vitest";
import { createAuthController, type AuthState } from "@/lib/auth";

describe("auth controller", () => {
  it("transitions from signed out to signed in and clears local state on sign out", async () => {
    const clearSensitiveState = vi.fn();
    const states: AuthState[] = [];
    const client = {
      auth: {
        async getSession() { return { data: { session: null }, error: null }; },
        async signInWithPassword() { return { data: { user: { id: "user-1", email: "user@example.invalid" }, session: { access_token: "token" } }, error: null }; },
        async signOut() { return { error: null }; },
        onAuthStateChange() { return { data: { subscription: { unsubscribe: vi.fn() } } }; },
      },
    };
    const controller = createAuthController({ client, clearSensitiveState });
    controller.subscribe((state) => states.push(state));
    await controller.start();
    await controller.signIn("user@example.invalid", "password");
    await controller.signOut();

    expect(states.map((state) => state.status)).toEqual(["signed-out", "signed-in", "signed-out"]);
    expect(clearSensitiveState).toHaveBeenCalledOnce();
  });

  it("allows offline access only when a cached authenticated session exists", async () => {
    const client = {
      auth: {
        async getSession() { throw new Error("offline"); },
        onAuthStateChange() { return { data: { subscription: { unsubscribe: vi.fn() } } }; },
      },
    };
    const controller = createAuthController({ client, hasCachedSession: async () => true });
    await controller.start();
    expect(controller.getState()).toMatchObject({ status: "offline-authenticated" });
  });
});
