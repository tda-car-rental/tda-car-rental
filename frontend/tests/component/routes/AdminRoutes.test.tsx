import { cleanup, render, screen } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/AuthGate", () => ({
  useWorkspaceContext: () => ({
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
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/admin/AdminDashboard", () => ({
  AdminDashboard: () => <div data-testid="admin-dashboard-page">Dashboard page</div>,
}));

vi.mock("@/components/admin/ApiDocumentation", () => ({
  ApiDocumentation: () => <div data-testid="api-documentation-page">API documentation page</div>,
}));

vi.mock("@/components/admin/UserManagement", () => ({
  UserManagement: () => <div data-testid="user-management-page">User management page</div>,
}));

vi.mock("@/components/admin/WorkspaceSettings", () => ({
  WorkspaceSettings: () => <div data-testid="workspace-settings-page">Workspace settings page</div>,
}));

import { getRouter } from "@/router";

afterEach(cleanup);

describe("admin routes", () => {
  it.each([
    ["/admin", "admin-dashboard-page"],
    ["/admin/api-docs", "api-documentation-page"],
    ["/admin/users", "user-management-page"],
    ["/admin/settings", "workspace-settings-page"],
  ])("renders the page for %s instead of the dashboard", async (path, pageTestId) => {
    window.history.pushState({}, "", path);
    const router = getRouter();

    render(<RouterProvider router={router} />);

    expect(await screen.findByTestId(pageTestId)).toBeInTheDocument();
  });
});
