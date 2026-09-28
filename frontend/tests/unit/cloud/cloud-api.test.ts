import { describe, expect, it, vi } from "vitest";
import { CloudApiError, createCloudApi } from "@/lib/cloud-api";

describe("cloud api", () => {
  it("adds the access token and calls an Edge Function endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ documents: [], nextCursor: null }), { status: 200 }));
    const api = createCloudApi({ baseUrl: "https://edge.example/functions/v1", getAccessToken: async () => "token", fetchImpl });

    await expect(api.listDocuments({ workspaceId: "workspace-1", kind: "billing", limit: 25 })).resolves.toEqual({ documents: [], nextCursor: null });
    expect(fetchImpl).toHaveBeenCalledWith("https://edge.example/functions/v1/documents?kind=billing&limit=25", expect.anything());
    const headers = new Headers(fetchImpl.mock.calls[0][1].headers);
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("x-workspace-id")).toBe("workspace-1");
  });

  it("maps stable server errors without exposing response internals", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Access denied." } }), { status: 403 }));
    const api = createCloudApi({ baseUrl: "https://edge.example/functions/v1", getAccessToken: async () => "token", fetchImpl });

    await expect(api.getWorkspaceContext()).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(api.getWorkspaceContext()).rejects.toBeInstanceOf(CloudApiError);
  });

  it("requests summaries through the Edge Function boundary", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ counts: {}, monthlyTotals: [] }), { status: 200 }));
    const api = createCloudApi({ baseUrl: "https://edge.example/functions/v1", getAccessToken: async () => "token", fetchImpl });

    await api.getSummary("workspace-1", { months: 6 });

    expect(fetchImpl).toHaveBeenCalledWith("https://edge.example/functions/v1/documents?months=6&summary=1", expect.anything());
  });

  it("lists members with a bounded cursor request and workspace scope", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ members: [], nextCursor: null }), { status: 200 }));
    const api = createCloudApi({ baseUrl: "https://edge.example/functions/v1", getAccessToken: async () => "token", fetchImpl });

    await api.listMembers({ workspaceId: "workspace-1", limit: 100, cursor: { createdAt: "2026-09-28T02:00:00.000Z", userId: "member-1" }, search: "person" });

    const [url, init] = fetchImpl.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/functions/v1/members");
    expect(parsed.searchParams.get("limit")).toBe("100");
    expect(parsed.searchParams.get("search")).toBe("person");
    expect(parsed.searchParams.get("cursor")).toBe(btoa(JSON.stringify({ createdAt: "2026-09-28T02:00:00.000Z", userId: "member-1" })));
    expect(new Headers(init.headers).get("x-workspace-id")).toBe("workspace-1");
  });

  it("serializes member mutations with explicit operations", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, memberId: "member-1" }), { status: 200 }));
    const api = createCloudApi({ baseUrl: "https://edge.example/functions/v1", getAccessToken: async () => "token", fetchImpl });

    await api.inviteMember("workspace-1", { email: "person@example.invalid", role: "bookkeeper" });
    await api.setMemberRole("workspace-1", "member-1", "administrator");
    await api.setMemberStatus("workspace-1", "member-1", false);
    await api.deleteMember("workspace-1", "member-1");

    expect(fetchImpl.mock.calls.map(([, init]) => JSON.parse(String(init.body)))).toEqual([
      { operation: "invite", email: "person@example.invalid", role: "bookkeeper" },
      { operation: "set-role", userId: "member-1", role: "administrator" },
      { operation: "deactivate", userId: "member-1" },
      { operation: "delete", userId: "member-1" },
    ]);
  });
});
