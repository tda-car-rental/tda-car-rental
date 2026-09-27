import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  listDocs: vi.fn(),
  deleteDoc: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/db", () => ({ ...mocks }));
vi.mock("@/lib/pdf", () => ({ generatePdf: vi.fn() }));

import { DocList } from "@/components/DocList";

describe("DocList navigation", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listDocs.mockResolvedValue([
      {
        id: 7,
        doc_type: "billing",
        doc_date: "14 June 2026",
        billed_to: "Path Foundation",
        unit: "Sedan",
        driver: "Teddy Dimate",
        requestor: "",
        total: 1200,
        items_json: "[]",
        created_at: "2026-06-14",
      },
    ]);
  });

  afterEach(cleanup);

  it("opens the billing create route", async () => {
    render(<DocList docType="billing" />);

    fireEvent.click(await screen.findByRole("button", { name: "Create Billing" }));

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/billing/new" });
  });

  it("opens the selected billing edit route", async () => {
    render(<DocList docType="billing" />);

    fireEvent.click(await screen.findByText("14 June 2026"));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/billing/$id/edit",
      params: { id: "7" },
    });
  });
});
