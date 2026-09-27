import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDocument = vi.fn();

vi.mock("pdfjs-dist", () => ({
  getDocument: (...args: unknown[]) => getDocument(...args),
  GlobalWorkerOptions: { workerSrc: "" },
}));

import { PdfPreview } from "@/components/pdf/PdfPreview";

function createMockPage() {
  const viewport = vi.fn().mockReturnValue({ width: 612, height: 792, scale: 1 });
  return {
    getViewport: viewport,
    render: vi.fn().mockResolvedValue(undefined),
  };
}

const mockCtx = {
  canvas: null as unknown as HTMLCanvasElement,
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn().mockReturnValue({ data: new Uint8Array() }),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 0 }),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  createPattern: vi.fn(),
} as unknown as CanvasRenderingContext2D;

describe("PdfPreview", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a canvas element after loading the PDF", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    });
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });

  it("shows a loading state instead of an empty page counter before the PDF resolves", () => {
    let resolvePdf: (value: { numPages: number; getPage: typeof vi.fn }) => void;
    getDocument.mockReturnValue({
      promise: new Promise((resolve) => {
        resolvePdf = resolve;
      }),
    });

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={vi.fn()} />);

    expect(screen.getByText("Loading PDF...")).toBeInTheDocument();
    expect(screen.queryByText(/Page 1 of 0/i)).not.toBeInTheDocument();

    resolvePdf!({
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(createMockPage()),
    });
  });

  it("calls onPageClick with canvas coordinates when clicked", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });
    const onPageClick = vi.fn();

    // Mock getContext before render
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={onPageClick} />);

    // Wait for canvas to be rendered with dimensions (indicates useEffect ran)
    await waitFor(() => {
      const canvas = screen.getByRole("img", { hidden: true });
      expect(canvas).toHaveAttribute("width", "612");
    });

    // Small delay for state to settle
    await new Promise((r) => setTimeout(r, 50));

    const canvas = screen.getByRole("img", { hidden: true });
    fireEvent.click(canvas, { clientX: 100, clientY: 200 });

    expect(onPageClick).toHaveBeenCalledWith(expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
      pageNumber: 0,
    }));

    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  it("navigates between pages", async () => {
    const mockPage = createMockPage();
    const mockPdf = {
      numPages: 2,
      getPage: vi.fn().mockResolvedValue(mockPage),
    };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(mockPdf.getPage).toHaveBeenCalledWith(1);
    });
  });

  it("uses a full-width preview surface so the page can scale beyond the default canvas size", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });

    render(<PdfPreview pdfBytes={new Uint8Array()} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
    });

    expect(screen.getByTestId("pdf-preview-surface")).toHaveClass("w-full");
  });

  it("retries without a worker when the initial pdf.js load fails", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };

    getDocument
      .mockReturnValueOnce({ promise: Promise.reject(new Error("Worker transport failed")) })
      .mockReturnValueOnce({ promise: Promise.resolve(mockPdf) });

    render(<PdfPreview pdfBytes={new Uint8Array([1, 2, 3])} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    });

    expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.any(Uint8Array),
    }));
    expect(getDocument.mock.calls.some(([options]) =>
      options &&
      typeof options === "object" &&
      "disableWorker" in (options as Record<string, unknown>) &&
      (options as Record<string, unknown>).disableWorker === true,
    )).toBe(true);
  });

  it("passes a cloned byte array into pdf.js so export can keep the original PDF bytes", async () => {
    const mockPage = createMockPage();
    const mockPdf = { numPages: 1, getPage: vi.fn().mockResolvedValue(mockPage) };
    getDocument.mockReturnValue({ promise: Promise.resolve(mockPdf) });
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);

    render(<PdfPreview pdfBytes={pdfBytes} onPageClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    });

    expect(getDocument.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        data: expect.any(Uint8Array),
      }),
    );
    expect(getDocument.mock.calls[0][0].data).not.toBe(pdfBytes);
  });
});
