export type PageViewport = {
  width: number;
  height: number;
};

export function canvasToPdf(
  canvasX: number,
  canvasY: number,
  viewport: PageViewport,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: canvasX * (viewport.width / canvasWidth),
    y: canvasY * (viewport.height / canvasHeight),
  };
}

export function pdfToCanvas(
  pdfX: number,
  pdfY: number,
  viewport: PageViewport,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: pdfX * (canvasWidth / viewport.width),
    y: pdfY * (canvasHeight / viewport.height),
  };
}
