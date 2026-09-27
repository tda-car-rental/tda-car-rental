import { describe, expect, it } from "vitest";
import { canvasToPdf, pdfToCanvas } from "@/lib/contract-pdf-coordinate";

describe("coordinate mapping", () => {
  const viewport = { width: 612, height: 792 }; // US Letter in points
  const canvasWidth = 800;
  const canvasHeight = 1040;

  it("maps canvas coordinates to PDF points", () => {
    const result = canvasToPdf(400, 520, viewport, canvasWidth, canvasHeight);
    expect(result).toEqual({ x: 306, y: 396 });
  });

  it("maps PDF points back to canvas coordinates", () => {
    const result = pdfToCanvas(306, 396, viewport, canvasWidth, canvasHeight);
    expect(result).toEqual({ x: 400, y: 520 });
  });

  it("round-trips canvas -> pdf -> canvas", () => {
    const original = { x: 123, y: 456 };
    const pdfCoords = canvasToPdf(original.x, original.y, viewport, canvasWidth, canvasHeight);
    const roundTripped = pdfToCanvas(pdfCoords.x, pdfCoords.y, viewport, canvasWidth, canvasHeight);
    expect(roundTripped.x).toBeCloseTo(original.x, 1);
    expect(roundTripped.y).toBeCloseTo(original.y, 1);
  });

  it("handles edge coordinates (0,0)", () => {
    const result = canvasToPdf(0, 0, viewport, canvasWidth, canvasHeight);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("handles maximum coordinates", () => {
    const result = canvasToPdf(canvasWidth, canvasHeight, viewport, canvasWidth, canvasHeight);
    expect(result).toEqual({ x: viewport.width, y: viewport.height });
  });
});
