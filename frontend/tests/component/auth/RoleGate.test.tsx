import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleGate } from "@/components/auth/RoleGate";
import { WorkspaceContextProvider } from "@/components/auth/AuthGate";

const context = {
  workspaceId: "workspace-1",
  workspaceName: "TDA Car Rental",
  role: "bookkeeper" as const,
  capabilities: {
    canAccessAdmin: false,
    canManageMembers: false,
    canManageWorkspaceSettings: false,
    canWriteContracts: false,
  },
};

describe("RoleGate", () => {
  it("renders content for an allowed role", () => {
    render(<WorkspaceContextProvider value={context}><RoleGate roles={["bookkeeper"]}>Billing</RoleGate></WorkspaceContextProvider>);
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });

  it("renders fallback for a role without the capability", () => {
    render(<WorkspaceContextProvider value={context}><RoleGate capability="canManageMembers" fallback={<span>Unavailable</span>}>Members</RoleGate></WorkspaceContextProvider>);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Members")).not.toBeInTheDocument();
  });
});
