import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist", () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getViewport: vi.fn().mockReturnValue({ width: 612, height: 792, scale: 1 }),
        render: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
  GlobalWorkerOptions: { workerSrc: "" },
}));

vi.mock("@/lib/contract-pdf", () => ({
  exportContractPdf: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

import { ContractEditor } from "@/components/ContractEditor";
import { exportContractPdf } from "@/lib/contract-pdf";

function getPdfCanvas() {
  const surface = screen.getByTestId("pdf-preview-surface");
  const canvas = surface.querySelector("canvas");
  if (!canvas) {
    throw new Error("Expected PDF canvas to be rendered");
  }
  return canvas;
}

describe("ContractEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // @ts-expect-error test cleanup
    delete window.tda;
  });

  it("shows upload area initially", () => {
    render(<ContractEditor />);
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument();
  });

  it("shows toolbar after PDF is loaded", async () => {
    render(<ContractEditor />);

    const file = new File(["dummy"], "contract.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/upload/i);
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/add text/i)).toBeInTheDocument();
    });
  });

  it("exports through the desktop bridge when download is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(""));
    window.tda = {
      documents: {
        save: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
      },
      migration: {
        scanChromium: vi.fn(),
        importFile: vi.fn(),
      },
      startup: {
        retry: vi.fn(),
        quit: vi.fn(),
      },
      files: {
        savePdf: vi.fn().mockResolvedValue({ canceled: false, filePath: "C:/tmp/contract-signed.pdf" }),
      },
    } as any;

    render(<ContractEditor />);

    const file = new File(["dummy"], "contract.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/upload/i);
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/download/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/download/i));

    await waitFor(() => {
      expect(exportContractPdf).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect((window.tda as any).files.savePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultFileName: expect.stringMatching(/^contract-signed/i),
          bytes: expect.any(Uint8Array),
        }),
      );
    });
  });

  it("allows placing text after a text overlay already exists", async () => {
    render(<ContractEditor />);

    const file = new File(["dummy"], "contract.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/upload/i);
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/add text/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("overlay-surface")).toBeInTheDocument();
    });
    const surface = screen.getByTestId("overlay-surface");

    fireEvent.click(screen.getByRole("button", { name: /add text/i }));
    fireEvent.click(surface, { clientX: 120, clientY: 140 });

    await waitFor(() => {
      expect(document.querySelectorAll("[data-overlay-item='text']")).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /add text/i }));
    fireEvent.click(surface, { clientX: 220, clientY: 240 });

    await waitFor(() => {
      expect(document.querySelectorAll("[data-overlay-item='text']")).toHaveLength(2);
    });
  });

  it("allows placing another signature after one is already on the page", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "Content-Type": "image/png" },
      }),
    );

    render(<ContractEditor />);

    const file = new File(["dummy"], "contract.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText(/upload/i);
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/add signature/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add signature/i }));
    fireEvent.click(await screen.findByRole("button", { name: /use signature/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /use signature/i })).not.toBeInTheDocument();
    });
    const canvas = getPdfCanvas();
    fireEvent.click(canvas, { clientX: 120, clientY: 140 });

    await waitFor(() => {
      expect(screen.getAllByAltText("Signature")).toHaveLength(1);
    });
    expect(screen.getAllByAltText("Signature")[0]).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\//),
    );

    fireEvent.click(screen.getByRole("button", { name: /add signature/i }));
    fireEvent.click(await screen.findByRole("button", { name: /use signature/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /use signature/i })).not.toBeInTheDocument();
    });
    fireEvent.click(canvas, { clientX: 220, clientY: 240 });

    await waitFor(() => {
      expect(screen.getAllByAltText("Signature")).toHaveLength(2);
    });
  });
});
