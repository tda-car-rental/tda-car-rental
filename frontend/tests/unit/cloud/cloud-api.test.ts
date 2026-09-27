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
});
