import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceContextProvider } from "@/components/auth/AuthGate";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { WorkspaceSettings } from "@/components/admin/WorkspaceSettings";

const ownerContext = {
  workspaceId: "workspace-1",
  workspaceName: "TDA Car Rental",
  role: "owner" as const,
  capabilities: { canAccessAdmin: true, canManageMembers: true, canManageWorkspaceSettings: true, canWriteContracts: true },
};

describe("admin overview pages", () => {
  it("renders only workspace metadata and capabilities", () => {
    render(<WorkspaceContextProvider value={ownerContext}><AdminDashboard /></WorkspaceContextProvider>);
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.getByText("TDA Car Rental")).toBeInTheDocument();
    expect(screen.getByText("encrypted at rest", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Sensitive customer")).not.toBeInTheDocument();
  });

  it("renders owner-safe settings without secret values", () => {
    render(<WorkspaceContextProvider value={ownerContext}><WorkspaceSettings /></WorkspaceContextProvider>);
    expect(screen.getByText("Workspace Settings")).toBeInTheDocument();
    expect(screen.getByText("Encryption keys and service credentials are never returned to the client.")).toBeInTheDocument();
    expect(screen.queryByText(/service_role|DOCUMENT_ENCRYPTION_KEY/i)).not.toBeInTheDocument();
  });
});
