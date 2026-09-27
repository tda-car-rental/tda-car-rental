import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";

const db = vi.hoisted(() => ({ saveDoc: vi.fn(), updateDoc: vi.fn(), getDoc: vi.fn() }));
const pdf = vi.hoisted(() => ({ generatePdf: vi.fn() }));

vi.mock("@/lib/db", () => ({ ...db }));
vi.mock("@/lib/pdf", () => ({ ...pdf }));

import { DocumentEditor } from "@/components/DocumentEditor";

describe("DocumentEditor", () => {
  beforeEach(() => {
    db.saveDoc.mockReset().mockResolvedValue(8);
    db.updateDoc.mockReset().mockResolvedValue(undefined);
    db.getDoc.mockReset().mockResolvedValue({
      id: 8,
      doc_type: "billing",
      doc_date: "14 June 2026",
      billed_to: "Path Foundation",
      unit: "Sedan",
      driver: "Teddy Dimate",
      requestor: "",
      total: 0,
      items_json: "[]",
      created_at: "2026-08-04 10:00:00",
    });
    pdf.generatePdf.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("updates the current document instead of inserting another record", async () => {
    render(
      <DocumentEditor
        docType="billing"
        documentId={7}
        initial={{
          date: "14 June 2026",
          billedTo: "Path Foundation",
          unit: "Sedan",
          driver: "Teddy Dimate",
          items: [],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(db.updateDoc).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          doc_type: "billing",
          doc_date: "14 June 2026",
          billed_to: "Path Foundation",
        }),
      );
    });
    expect(db.saveDoc).not.toHaveBeenCalled();
  });

  it("verifies a newly saved document exists before calling onSaved", async () => {
    const onSaved = vi.fn();
    render(<DocumentEditor docType="billing" onSaved={onSaved} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(db.saveDoc).toHaveBeenCalledTimes(1);
      expect(db.getDoc).toHaveBeenCalledWith(8);
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });

  it("shows an error and stays on the page when persistence verification fails", async () => {
    db.getDoc.mockResolvedValueOnce(undefined);
    const onSaved = vi.fn();
    render(
      <>
        <DocumentEditor docType="billing" onSaved={onSaved} />
        <Toaster />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText(/couldn't confirm the document was saved/i)).toBeInTheDocument();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("picks the document date from the calendar in long format", async () => {
    render(
      <DocumentEditor
        docType="billing"
        initial={{
          date: "14 June 2026",
          billedTo: "Path Foundation",
          driver: "Teddy Dimate",
          items: [],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Document date" }));
    fireEvent.click(screen.getByRole("button", { name: /june 15/i }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(db.saveDoc).toHaveBeenCalledWith(
        expect.objectContaining({ doc_date: "15 June 2026" }),
      );
    });
  });

  it("picks a line-item trip date from the calendar in short format", async () => {
    render(
      <DocumentEditor
        docType="billing"
        initial={{
          billedTo: "Path Foundation",
          driver: "Teddy Dimate",
          items: [
            {
              date: "11-Jun-26",
              destination: "Makati",
              passenger: "A. Cruz",
              unit: "Toyota HiAce",
              amount: 1200,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Item date 1" }));
    fireEvent.click(screen.getByRole("button", { name: /june 12/i }));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(db.saveDoc).toHaveBeenCalledTimes(1);
    });
    const saved = db.saveDoc.mock.calls[0][0];
    expect(JSON.parse(saved.items_json)).toEqual([expect.objectContaining({ date: "12-Jun-26" })]);
  });

  it("opens a preview tab before asynchronous PDF generation completes", async () => {
    let resolvePdf: (value: { output: (type: string) => string }) => void;
    pdf.generatePdf.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePdf = resolve;
      }),
    );
    const previewWindow = { location: { href: "" } } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(previewWindow);

    render(<DocumentEditor docType="billing" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview PDF" }));

    expect(open).toHaveBeenCalledWith("", "_blank");
    resolvePdf!({ output: () => "blob:preview" });
    await waitFor(() => {
      expect(previewWindow.location.href).toBe("blob:preview");
    });
  });

  it("synchronizes billing passengers and units from the first row", async () => {
    render(
      <DocumentEditor
        docType="billing"
        initial={{
          billedTo: "Path Foundation",
          driver: "Teddy Dimate",
          items: [
            {
              date: "11-Jun-26",
              destination: "Makati",
              passenger: "A. Cruz",
              unit: "Toyota HiAce",
              amount: 1200,
            },
            {
              date: "12-Jun-26",
              destination: "Subic",
              passenger: "B. Reyes",
              unit: "Mitsubishi L300",
              amount: 900,
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText("Unit Used")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Requestor")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Same passenger?" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Same unit?" }));
    fireEvent.change(screen.getByLabelText("Passenger 1"), { target: { value: "C. Santos" } });
    fireEvent.change(screen.getByLabelText("Unit 1"), { target: { value: "Toyota Commuter" } });
    fireEvent.click(screen.getByRole("button", { name: /add row/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByLabelText("Passenger 2")).toHaveValue("C. Santos");
    expect(screen.getByLabelText("Passenger 2")).toBeDisabled();
    expect(screen.getByLabelText("Unit 2")).toHaveValue("Toyota Commuter");
    expect(screen.getByLabelText("Unit 2")).toBeDisabled();
    expect(screen.getByLabelText("Unit 3")).toHaveValue("Toyota Commuter");
    await waitFor(() => expect(db.saveDoc).toHaveBeenCalledTimes(1));
    expect(db.saveDoc.mock.calls[0][0]).toMatchObject({
      doc_type: "billing",
      unit: "Toyota Commuter",
    });
    expect(JSON.parse(db.saveDoc.mock.calls[0][0].items_json)).toEqual(
      expect.arrayContaining([expect.objectContaining({ unit: "Toyota Commuter" })]),
    );
  });

  it("synchronizes quotation passengers and units from the first row", () => {
    render(
      <DocumentEditor
        docType="quotation"
        initial={{
          date: "14 June 2026",
          requestor: "Path Foundation",
          items: [
            {
              date: "11-Jun-26",
              destination: "Makati",
              passenger: "A. Cruz",
              unit: "Toyota HiAce",
              amount: 1200,
            },
            {
              date: "12-Jun-26",
              destination: "Subic",
              passenger: "B. Reyes",
              unit: "Mitsubishi L300",
              amount: 900,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Same passenger?" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Same unit?" }));
    fireEvent.change(screen.getByLabelText("Passenger 1"), { target: { value: "C. Santos" } });
    fireEvent.change(screen.getByLabelText("Unit 1"), { target: { value: "Toyota Commuter" } });
    fireEvent.click(screen.getByRole("button", { name: /add row/i }));

    expect(screen.getByLabelText("Passenger 2")).toHaveValue("C. Santos");
    expect(screen.getByLabelText("Passenger 2")).toBeDisabled();
    expect(screen.getByLabelText("Unit 2")).toHaveValue("Toyota Commuter");
    expect(screen.getByLabelText("Unit 2")).toBeDisabled();
    expect(screen.getByLabelText("Passenger 3")).toHaveValue("C. Santos");
    expect(screen.getByLabelText("Unit 3")).toHaveValue("Toyota Commuter");
  });

  it("saves a multi-unit quotation using its line-item units", async () => {
    render(
      <DocumentEditor
        docType="quotation"
        initial={{
          items: [
            {
              date: "11-Jun-26",
              destination: "Makati",
              passenger: "A. Cruz",
              unit: "Toyota HiAce",
              amount: 1200,
            },
            {
              date: "12-Jun-26",
              destination: "Subic",
              passenger: "B. Reyes",
              unit: "Mitsubishi L300",
              amount: 900,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(db.saveDoc).toHaveBeenCalledTimes(1));
    const saved = db.saveDoc.mock.calls[0][0];
    expect(saved).toMatchObject({ doc_type: "quotation", unit: "Multiple units" });
    expect(JSON.parse(saved.items_json)).toEqual([
      expect.objectContaining({ unit: "Toyota HiAce" }),
      expect.objectContaining({ unit: "Mitsubishi L300" }),
    ]);
  });

  it("saves a shared quotation unit as the document summary", async () => {
    render(
      <DocumentEditor
        docType="quotation"
        initial={{
          items: [
            {
              date: "11-Jun-26",
              destination: "Makati",
              passenger: "A. Cruz",
              unit: "Toyota HiAce",
              amount: 1200,
            },
            {
              date: "12-Jun-26",
              destination: "Subic",
              passenger: "B. Reyes",
              unit: "Toyota HiAce",
              amount: 900,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(db.saveDoc).toHaveBeenCalledTimes(1));
    expect(db.saveDoc.mock.calls[0][0]).toMatchObject({
      doc_type: "quotation",
      unit: "Toyota HiAce",
    });
  });

  it("saves blank quotation units with an empty summary", async () => {
    render(
      <DocumentEditor
        docType="quotation"
        initial={{
          items: [
            {
              date: "11-Jun-26",
              destination: "Makati",
              passenger: "A. Cruz",
              unit: "",
              amount: 1200,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(db.saveDoc).toHaveBeenCalledTimes(1));
    expect(db.saveDoc.mock.calls[0][0]).toMatchObject({ doc_type: "quotation", unit: "" });
  });

  it("keeps the action buttons in a sticky footer for smaller desktop windows", () => {
    render(<DocumentEditor docType="billing" />);

    const saveButton = screen.getByRole("button", { name: "Save" });
    const actions = saveButton.parentElement;

    expect(actions).not.toBeNull();
    expect(actions).toHaveClass("sticky");
    expect(actions).toHaveClass("bottom-0");
  });
});
