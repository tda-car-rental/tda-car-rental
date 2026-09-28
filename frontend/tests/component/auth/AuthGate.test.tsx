import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthGate, useCloudApi } from "@/components/auth/AuthGate";
import type { CloudApi } from "@/lib/cloud-api";

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
  it("provides the authenticated API instance to cloud consumers by default", async () => {
    const auth = {
      ...signedOutAuth(),
      getState: () => ({
        status: "signed-in" as const,
        user: { id: "user-1" },
        accessToken: "token",
      }),
    };
    const api = {
      getWorkspaceContext: vi.fn().mockResolvedValue({
        workspaceId: "workspace-1",
        workspaceName: "TDA Car Rental",
        role: "owner",
        capabilities: {
          canAccessAdmin: true,
          canManageMembers: true,
          canManageWorkspaceSettings: true,
          canWriteContracts: true,
        },
      }),
    } as unknown as CloudApi;

    function CloudConsumer() {
      return <div>{useCloudApi() === api ? "Cloud API available" : "Wrong API"}</div>;
    }

    render(
      <AuthGate auth={auth} api={api}>
        <CloudConsumer />
      </AuthGate>,
    );

    await waitFor(() => expect(screen.getByText("Cloud API available")).toBeInTheDocument());
  });

  it("renders login instead of application content when signed out", async () => {
    const auth = signedOutAuth();
    render(
      <AuthGate auth={auth} api={{ getWorkspaceContext: vi.fn() }}>
        <div>Application</div>
      </AuthGate>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "TDA Car Rental" })).toBeInTheDocument(),
    );
    expect(screen.queryByText("Application")).not.toBeInTheDocument();
  });

  it("loads workspace context before rendering application content", async () => {
    const auth = {
      ...signedOutAuth(),
      getState: () => ({
        status: "signed-in" as const,
        user: { id: "user-1" },
        accessToken: "token",
      }),
    };
    const api = {
      getWorkspaceContext: vi.fn().mockResolvedValue({
        workspaceId: "workspace-1",
        workspaceName: "TDA Car Rental",
        role: "owner",
        capabilities: {
          canAccessAdmin: true,
          canManageMembers: true,
          canManageWorkspaceSettings: true,
          canWriteContracts: true,
        },
      }),
    };
    render(
      <AuthGate auth={auth} api={api}>
        <div>Application</div>
      </AuthGate>,
    );
    await waitFor(() => expect(screen.getByText("Application")).toBeInTheDocument());
    expect(api.getWorkspaceContext).toHaveBeenCalledOnce();
  });

  it("opens cached workspace content after a previously authenticated session loses connectivity", async () => {
    const auth = {
      ...signedOutAuth(),
      getState: () => ({ status: "offline-authenticated" as const }),
    };
    render(
      <AuthGate
        auth={auth}
        api={{ getWorkspaceContext: vi.fn() }}
        getCachedWorkspaceContext={async () => ({
          workspaceId: "workspace-1",
          workspaceName: "TDA Car Rental",
          role: "bookkeeper",
          capabilities: {
            canAccessAdmin: false,
            canManageMembers: false,
            canManageWorkspaceSettings: false,
            canWriteContracts: false,
          },
        })}
      >
        <div>Cached application</div>
      </AuthGate>,
    );
    await waitFor(() => expect(screen.getByText("Cached application")).toBeInTheDocument());
  });
});
