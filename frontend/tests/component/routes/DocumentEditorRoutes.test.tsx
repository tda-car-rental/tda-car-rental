import { cleanup, render, screen } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  deleteDoc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue(undefined),
  listDocs: vi.fn().mockResolvedValue([]),
  saveDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ ...db }));
vi.mock("@/lib/pdf", () => ({ generatePdf: vi.fn() }));

import { getRouter } from "@/router";

afterEach(cleanup);

describe("document editor routes", () => {
  it.each([
    ["/billing/new", "New document"],
    ["/billing/999/edit", "Update saved document"],
    ["/quotation/new", "New document"],
    ["/quotation/999/edit", "Update saved document"],
  ])(
    "renders the full-page editor at %s",
    async (path, marker) => {
      window.history.pushState({}, "", path);
      const router = getRouter();

      render(<RouterProvider router={router} />);

      // First route load lazily imports the editor dependencies (e.g. the date
      // picker's calendar), which is slow in the jsdom environment.
      expect(await screen.findByText(marker, {}, { timeout: 15000 })).toBeInTheDocument();
    },
    20000,
  );
});
