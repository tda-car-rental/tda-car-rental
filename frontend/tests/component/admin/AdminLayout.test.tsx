import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) => select({ location: { pathname: "/admin/users" } }),
}));

import { WorkspaceContextProvider } from "@/components/auth/AuthGate";
import { AdminLayout } from "@/components/admin/AdminLayout";

const capabilities = {
  canAccessAdmin: true,
  canManageMembers: true,
  canManageWorkspaceSettings: true,
  canWriteContracts: true,
};

describe("AdminLayout", () => {
  afterEach(() => cleanup());

  it("shows the shared tabs and owner-only settings for an owner", () => {
    render(
      <WorkspaceContextProvider value={{ workspaceId: "workspace-1", workspaceName: "TDA Car Rental", role: "owner", capabilities }}>
        <AdminLayout title="User Management"><div>Member table</div></AdminLayout>
      </WorkspaceContextProvider>,
    );

    expect(screen.getByRole("tab", { name: "Admin Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "API Documentation" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Workspace Settings" })).toBeInTheDocument();
  });

  it("does not show workspace settings for an administrator", () => {
    render(
      <WorkspaceContextProvider value={{ workspaceId: "workspace-1", workspaceName: "TDA Car Rental", role: "administrator", capabilities: { ...capabilities, canManageWorkspaceSettings: false } }}>
        <AdminLayout title="User Management"><div>Member table</div></AdminLayout>
      </WorkspaceContextProvider>,
    );

    expect(screen.getByRole("tab", { name: "Admin Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "API Documentation" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "User Management" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Workspace Settings" })).not.toBeInTheDocument();
  });

  it("denies the admin surface to a bookkeeper before child content renders", () => {
    render(
      <WorkspaceContextProvider value={{ workspaceId: "workspace-1", workspaceName: "TDA Car Rental", role: "bookkeeper", capabilities: { ...capabilities, canAccessAdmin: false, canManageMembers: false, canManageWorkspaceSettings: false } }}>
        <AdminLayout title="User Management"><div>Member table</div></AdminLayout>
      </WorkspaceContextProvider>,
    );

    expect(screen.getByText("This area is restricted")).toBeInTheDocument();
    expect(screen.queryByText("Member table")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "User Management" })).not.toBeInTheDocument();
  });
});
