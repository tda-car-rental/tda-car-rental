import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OverlayItem } from "@/lib/contract-pdf.types";

const { mockDrawText, mockDrawImage, mockEmbedPng, mockEmbedFont, mockSave } = vi.hoisted(() => ({
  mockDrawText: vi.fn(),
  mockDrawImage: vi.fn(),
  mockEmbedPng: vi.fn().mockResolvedValue({}),
  mockEmbedFont: vi.fn().mockResolvedValue({}),
  mockSave: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

vi.mock("pdf-lib", () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      embedPng: mockEmbedPng,
      embedFont: mockEmbedFont,
      getPages: vi.fn().mockReturnValue([
        {
          drawText: mockDrawText,
          drawImage: mockDrawImage,
          getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
        },
      ]),
      save: mockSave,
    }),
  },
  StandardFonts: { Helvetica: "Helvetica" },
}));

import { exportContractPdf } from "@/lib/contract-pdf";

describe("exportContractPdf", () => {
  beforeEach(() => {
    mockDrawText.mockClear();
    mockDrawImage.mockClear();
    mockEmbedPng.mockClear();
    mockEmbedFont.mockClear();
    mockSave.mockClear();
  });

  it("draws text overlays on the PDF", async () => {
    const overlays: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "John Doe",
        fontSize: 12,
      },
    ];

    await exportContractPdf({ pdfBytes: new Uint8Array(), overlays });

    expect(mockDrawText).toHaveBeenCalledWith("John Doe", {
      x: 100,
      y: 200,
      size: 12,
      font: expect.anything(),
    });
  });

  it("embeds and draws signature overlays", async () => {
    const overlays: OverlayItem[] = [
      {
        id: "sig-1",
        type: "signature",
        pageNumber: 0,
        x: 300,
        y: 400,
        width: 120,
        height: 80,
      },
    ];

    await exportContractPdf({
      pdfBytes: new Uint8Array(),
      overlays,
      signatureDataUrl: "data:image/png;base64,abc123",
    });

    expect(mockEmbedPng).toHaveBeenCalled();
    expect(mockDrawImage).toHaveBeenCalledWith(expect.anything(), {
      x: 300,
      y: 400,
      width: 120,
      height: 80,
    });
  });

  it("skips text overlays with empty content", async () => {
    const overlays: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "",
        fontSize: 12,
      },
    ];

    await exportContractPdf({ pdfBytes: new Uint8Array(), overlays });

    expect(mockDrawText).not.toHaveBeenCalled();
  });

  it("uses default fontSize of 12 when not specified", async () => {
    const overlays: OverlayItem[] = [
      {
        id: "1",
        type: "text",
        pageNumber: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 20,
        content: "Test",
      },
    ];

    await exportContractPdf({ pdfBytes: new Uint8Array(), overlays });

    expect(mockDrawText).toHaveBeenCalledWith("Test", {
      x: 100,
      y: 200,
      size: 12,
      font: expect.anything(),
    });
  });

  it("returns the saved PDF bytes", async () => {
    const result = await exportContractPdf({ pdfBytes: new Uint8Array(), overlays: [] });

    expect(result).toBeInstanceOf(Uint8Array);
    expect(mockSave).toHaveBeenCalled();
  });
});
