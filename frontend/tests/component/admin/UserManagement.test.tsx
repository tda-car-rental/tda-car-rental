import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudApiProvider, WorkspaceContextProvider } from "@/components/auth/AuthGate";
import { UserManagement } from "@/components/admin/UserManagement";
import type { CloudApi } from "@/lib/cloud-api";

const context = {
  workspaceId: "workspace-1",
  workspaceName: "TDA Car Rental",
  role: "administrator" as const,
  capabilities: {
    canAccessAdmin: true,
    canManageMembers: true,
    canManageWorkspaceSettings: false,
    canWriteContracts: true,
  },
};

function renderPage(api: CloudApi) {
  return render(
    <WorkspaceContextProvider value={context}>
      <CloudApiProvider value={api}>
        <UserManagement />
      </CloudApiProvider>
    </WorkspaceContextProvider>,
  );
}

describe("UserManagement", () => {
  afterEach(() => cleanup());

  it("loads one bounded page and invites a user through the cloud API", async () => {
    const api = {
      listMembers: vi.fn().mockResolvedValue({
        members: [
          {
            userId: "member-1",
            email: "existing@example.invalid",
            role: "bookkeeper",
            active: true,
            createdAt: "2026-09-28T00:00:00.000Z",
            updatedAt: "2026-09-28T00:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
      inviteMember: vi.fn().mockResolvedValue({ memberId: "member-2" }),
      setMemberRole: vi.fn(),
      setMemberStatus: vi.fn(),
    } as unknown as CloudApi;
    renderPage(api);

    expect(await screen.findByText("existing@example.invalid")).toBeInTheDocument();
    expect(api.listMembers).toHaveBeenCalledWith({ workspaceId: "workspace-1", limit: 50 });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new@example.invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    await waitFor(() =>
      expect(api.inviteMember).toHaveBeenCalledWith("workspace-1", {
        email: "new@example.invalid",
        role: "bookkeeper",
      }),
    );
  });

  it("requests the next page only when Load more is activated", async () => {
    const api = {
      listMembers: vi
        .fn()
        .mockResolvedValueOnce({
          members: [
            {
              userId: "member-1",
              email: "one@example.invalid",
              role: "bookkeeper",
              active: true,
              createdAt: "2026-09-28T00:00:00.000Z",
              updatedAt: "2026-09-28T00:00:00.000Z",
            },
          ],
          nextCursor: btoa(
            JSON.stringify({ createdAt: "2026-09-28T00:00:00.000Z", userId: "member-1" }),
          ),
        })
        .mockResolvedValueOnce({
          members: [
            {
              userId: "member-2",
              email: "two@example.invalid",
              role: "administrator",
              active: false,
              createdAt: "2026-09-27T00:00:00.000Z",
              updatedAt: "2026-09-27T00:00:00.000Z",
            },
          ],
          nextCursor: null,
        }),
      inviteMember: vi.fn(),
      setMemberRole: vi.fn(),
      setMemberStatus: vi.fn(),
    } as unknown as CloudApi;
    renderPage(api);

    expect(await screen.findByText("one@example.invalid")).toBeInTheDocument();
    expect(screen.queryByText("two@example.invalid")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Load more/i }));
    expect(await screen.findByText("two@example.invalid")).toBeInTheDocument();
    expect(api.listMembers).toHaveBeenCalledTimes(2);
  });

  it("updates member role and reactivation status through explicit mutations", async () => {
    const api = {
      listMembers: vi.fn().mockResolvedValue({
        members: [
          {
            userId: "member-1",
            email: "inactive@example.invalid",
            role: "bookkeeper",
            active: false,
            createdAt: "2026-09-28T00:00:00.000Z",
            updatedAt: "2026-09-28T00:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
      inviteMember: vi.fn(),
      setMemberRole: vi.fn().mockResolvedValue({ ok: true, memberId: "member-1" }),
      setMemberStatus: vi.fn().mockResolvedValue({ ok: true, memberId: "member-1" }),
    } as unknown as CloudApi;
    renderPage(api);

    await screen.findByText("inactive@example.invalid");
    fireEvent.change(screen.getByLabelText("Role for inactive@example.invalid"), {
      target: { value: "administrator" },
    });
    await waitFor(() =>
      expect(api.setMemberRole).toHaveBeenCalledWith("workspace-1", "member-1", "administrator"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reactivate" }));
    await waitFor(() =>
      expect(api.setMemberStatus).toHaveBeenCalledWith("workspace-1", "member-1", true),
    );
  });
});
