import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth/AuthGate";

function signedOutAuth() {
  return {
    getState: () => ({ status: "signed-out" as const }),
    subscribe: () => () => undefined,
    start: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AuthGate", () => {
  it("renders login instead of application content when signed out", async () => {
    const auth = signedOutAuth();
    render(<AuthGate auth={auth} api={{ getWorkspaceContext: vi.fn() }}><div>Application</div></AuthGate>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "TDA Car Rental" })).toBeInTheDocument());
    expect(screen.queryByText("Application")).not.toBeInTheDocument();
  });

  it("loads workspace context before rendering application content", async () => {
    const auth = {
      ...signedOutAuth(),
      getState: () => ({ status: "signed-in" as const, user: { id: "user-1" }, accessToken: "token" }),
    };
    const api = { getWorkspaceContext: vi.fn().mockResolvedValue({ workspaceId: "workspace-1", workspaceName: "TDA Car Rental", role: "owner", capabilities: { canManageMembers: true, canWriteContracts: true } }) };
    render(<AuthGate auth={auth} api={api}><div>Application</div></AuthGate>);
    await waitFor(() => expect(screen.getByText("Application")).toBeInTheDocument());
    expect(api.getWorkspaceContext).toHaveBeenCalledOnce();
  });
});
