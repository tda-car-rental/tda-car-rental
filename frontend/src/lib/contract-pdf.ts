import { PDFDocument, StandardFonts } from "pdf-lib";
import type { ContractPdfInput } from "./contract-pdf.types";

export async function exportContractPdf(input: ContractPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(input.pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let signatureImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | Awaited<ReturnType<typeof pdfDoc.embedJpg>> | undefined;
  if (input.signatureDataUrl) {
    const base64 = input.signatureDataUrl.split(",")[1];
    const imageBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (input.signatureDataUrl.includes("image/jpeg")) {
      signatureImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      signatureImage = await pdfDoc.embedPng(imageBytes);
    }
  }

  for (const overlay of input.overlays) {
    const page = pages[overlay.pageNumber];
    if (!page) continue;

    if (overlay.type === "text" && overlay.content) {
      page.drawText(overlay.content, {
        x: overlay.x,
        y: overlay.y,
        size: overlay.fontSize ?? 12,
        font,
      });
    } else if (overlay.type === "signature" && signatureImage) {
      page.drawImage(signatureImage, {
        x: overlay.x,
        y: overlay.y,
        width: overlay.width,
        height: overlay.height,
      });
    }
  }

  return pdfDoc.save();
}
