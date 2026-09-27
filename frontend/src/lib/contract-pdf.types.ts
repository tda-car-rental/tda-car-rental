export type OverlayItem = {
  id: string;
  type: "text" | "signature";
  pageNumber: number;
  x: number;       // PDF points (1/72 inch)
  y: number;
  width: number;   // PDF points
  height: number;
  content?: string;
  fontSize?: number;
};

export type ContractPdfInput = {
  pdfBytes: Uint8Array;
  overlays: OverlayItem[];
  signatureDataUrl?: string;
};
