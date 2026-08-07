// PDF generation matching the reference layout (TDA Car Rental Services).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Item } from "./db";

const signatureAssets = import.meta.glob("../../signature/*.{jpg,jpeg,png,JPG,JPEG,PNG}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const [signaturePath, signatureUrl] = Object.entries(signatureAssets).sort(([left], [right]) => {
  const leftIsPng = left.toLowerCase().endsWith(".png");
  const rightIsPng = right.toLowerCase().endsWith(".png");
  if (leftIsPng !== rightIsPng) return leftIsPng ? -1 : 1;
  return left.localeCompare(right);
})[0] ?? [];

export type PdfInput =
  | {
      docType: "billing" | "quotation";
      date: string; // e.g. "14 June 2026"
      billedTo?: string;
      unit: string;
      driver?: string;
      requestor?: string;
      items: Item[];
    }
  | {
      docType: "acknowledgement";
      date: string;
      refNo: string;
      amount: number;
      details: string;
      receivedBy: string;
      dateReceived: string;
    };

let britannicBoldBase64: Promise<string> | undefined;
let sharedSignature: Promise<{ data: string; format: "JPEG" | "PNG" } | undefined> | undefined;

function arrayBufferToBase64(data: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(data)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function loadBritannicBold(): Promise<string> {
  britannicBoldBase64 ??= fetch("/Britannic%20Bold%20Regular.ttf")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Could not load Britannic Bold for PDF generation.");
      }
      return response.arrayBuffer();
    })
    .then(arrayBufferToBase64);
  return britannicBoldBase64;
}

function loadSharedSignature(): Promise<{ data: string; format: "JPEG" | "PNG" } | undefined> {
  sharedSignature ??= !signatureUrl
    ? Promise.resolve(undefined)
    : fetch(signatureUrl)
        .then(async (response) => {
          if (!response.ok) return undefined;
          const mimeType = signaturePath?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
          return {
            data: `data:${mimeType};base64,${arrayBufferToBase64(await response.arrayBuffer())}`,
            format: mimeType === "image/png" ? "PNG" : "JPEG",
          } as const;
        })
        .catch(() => undefined);
  return sharedSignature;
}

const money = (n: number) =>
  "PHP " + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function amountInWords(value: number): string {
  const units = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  const belowThousand = (n: number): string => {
    const pieces: string[] = [];
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    if (hundreds) pieces.push(`${units[hundreds]} hundred`);
    if (remainder >= 20) {
      pieces.push(tens[Math.floor(remainder / 10)]);
      if (remainder % 10) pieces.push(units[remainder % 10]);
    } else if (remainder >= 10) {
      pieces.push(teens[remainder - 10]);
    } else if (remainder > 0 || !pieces.length) {
      pieces.push(units[remainder]);
    }
    return pieces.join(" ");
  };

  const rounded = Math.max(0, Math.round(value * 100)) / 100;
  const whole = Math.floor(rounded);
  const cents = Math.round((rounded - whole) * 100);
  const pieces: string[] = [];

  const billions = Math.floor(whole / 1_000_000_000);
  const millions = Math.floor((whole % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((whole % 1_000_000) / 1_000);
  const remainder = whole % 1_000;

  if (billions) pieces.push(`${belowThousand(billions)} billion`);
  if (millions) pieces.push(`${belowThousand(millions)} million`);
  if (thousands) pieces.push(`${belowThousand(thousands)} thousand`);
  if (remainder || !pieces.length) pieces.push(belowThousand(remainder));

  const base = sentenceCase(pieces.join(" "));
  return cents ? `${base} pesos and ${String(cents).padStart(2, "0")}/100 only` : `${base} pesos only`;
}

function drawAcknowledgementReceipt(
  doc: jsPDF,
  input: Extract<PdfInput, { docType: "acknowledgement" }>,
  signature: Awaited<ReturnType<typeof loadSharedSignature>>,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 24;
  const leftLabelX = 86;
  const valueX = 180;
  const lineWidth = 270;
  const shortLineWidth = 150;
  let y = 56;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Acknowledgment Receipt", pageW / 2, y, { align: "center" });

  y = 96;
  const drawField = (label: string, value: string, width: number = lineWidth) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, leftLabelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, valueX, y);
    doc.line(valueX, y + 2, valueX + width, y + 2);
    y += 22;
  };

  drawField("Date", input.date, shortLineWidth);
  drawField("Ref No.", input.refNo, shortLineWidth);

  doc.setFont("helvetica", "bold");
  doc.text("Amount", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(money(input.amount), valueX, y);
  doc.line(valueX, y + 2, valueX + lineWidth, y + 2);
  y += 22;
  doc.text(amountInWords(input.amount), valueX, y);
  doc.line(valueX, y + 2, valueX + lineWidth, y + 2);
  y += 38;

  doc.setFont("helvetica", "bold");
  doc.text("Details", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  const detailLines = doc.splitTextToSize(input.details, lineWidth);
  doc.text(detailLines, valueX, y);
  doc.line(valueX, y + 2, valueX + lineWidth, y + 2);
  y += Math.max(detailLines.length, 1) * 18 + 10;

  doc.setFont("helvetica", "bold");
  doc.text("Received by:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(input.receivedBy, valueX, y);
  doc.line(valueX, y + 2, valueX + 190, y + 2);
  if (signature) {
    doc.addImage(signature.data, signature.format, valueX + 10, y - 40, 110, 36);
  }
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.text("Date Received:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(input.dateReceived, valueX, y);
  doc.line(valueX, y + 2, valueX + shortLineWidth, y + 2);
}

type DrawnQuoteCell = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfMergedCellRun = {
  value: string;
  startRow: number;
  endRow: number;
  cells: DrawnQuoteCell[];
};

function adjacentPdfValueRuns(items: Item[], field: "unit" | "passenger"): PdfMergedCellRun[] {
  const runs: PdfMergedCellRun[] = [];
  let startRow = 0;

  while (startRow < items.length) {
    const value = items[startRow]?.[field] ?? "";
    if (!value.trim()) {
      startRow += 1;
      continue;
    }

    let endRow = startRow;
    while (endRow + 1 < items.length && (items[endRow + 1]?.[field] ?? "") === value) {
      endRow += 1;
    }
    if (endRow > startRow) runs.push({ value, startRow, endRow, cells: [] });
    startRow = endRow + 1;
  }

  return runs;
}

function pdfRunByRow(runs: PdfMergedCellRun[]): Map<number, PdfMergedCellRun> {
  const byRow = new Map<number, PdfMergedCellRun>();
  for (const run of runs) {
    for (let row = run.startRow; row <= run.endRow; row += 1) {
      byRow.set(row, run);
    }
  }
  return byRow;
}

function quoteSharedColumnWidth(index: 1 | 3): number {
  return index === 1 ? 75 : 85;
}

function quoteSpanLines(doc: jsPDF, value: string, width: number, horizontalPadding: number): string[] {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return doc.splitTextToSize(value, width - horizontalPadding);
}

function drawMergedQuoteSpan(doc: jsPDF, cells: DrawnQuoteCell[], value: string, pageNumber: number) {
  const pageCells = cells.filter((cell) => cell.pageNumber === pageNumber);
  if (!pageCells.length) return;

  const first = pageCells[0];
  const top = Math.min(...pageCells.map((cell) => cell.y));
  const bottom = Math.max(...pageCells.map((cell) => cell.y + cell.height));
  const height = bottom - top;

  doc.setFillColor(255, 255, 255);
  doc.rect(first.x, top, first.width, height, "F");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.rect(first.x, top, first.width, height, "S");
  doc.setTextColor(0, 0, 0);
  const lines = quoteSpanLines(doc, value, first.width, 12);
  const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
  const textY = top + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  doc.text(lines, first.x + first.width / 2, textY, { align: "center", baseline: "middle" });
}

export async function generatePdf(input: PdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 80;
  const marginR = 60;

  const [britannicBold, signature] = await Promise.all([
    loadBritannicBold(),
    input.docType === "quotation" ? Promise.resolve(undefined) : loadSharedSignature(),
  ]);
  doc.addFileToVFS("Britannic Bold Regular.ttf", britannicBold);
  doc.addFont("Britannic Bold Regular.ttf", "Britannic Bold", "normal");

  if (input.docType === "acknowledgement") {
    drawAcknowledgementReceipt(doc, input, signature);
    return doc;
  }

  // Header — big bold title
  doc.setFont("Britannic Bold", "normal");
  doc.setFontSize(22);
  doc.text("TDA CAR RENTAL SERVICES", marginL, 90);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 110;
  const lineGap = 13;
  doc.text("Non-VAT Reg. TIN: 209-021-244-0000", marginL, y); y += lineGap;
  doc.text("2746 Rizal Avenue East Bajac Bajac 2200", marginL, y); y += lineGap;
  doc.text("Olongapo City Zambales, Philippines", marginL, y); y += lineGap;
  doc.text("TEDDY T. DIMATE, JR.", marginL, y);

  y = 200;
  doc.text(`Date: ${input.date}`, marginL, y);
  y += 24;

  if (input.docType === "billing") {
    doc.text("Billed To:", marginL, y); y += lineGap;
    doc.text(input.billedTo || "", marginL, y); y += 24;
    doc.text("DETAILS: CAR RENTAL SERVICES", marginL, y); y += 30;
    doc.text(`Driver: ${input.driver || ""}`, marginL, y); y += 14;
  } else {
    doc.text("QUOTATION REQUEST", marginL, y); y += lineGap;
    doc.text(`Requestor: ${input.requestor || ""}`, marginL, y); y += 24;
  }

  const tableStartY = y;
  const tableItems = input.items.map((item) => ({ ...item, unit: item.unit ?? input.unit }));
  const unitRuns = adjacentPdfValueRuns(tableItems, "unit");
  const passengerRuns = adjacentPdfValueRuns(tableItems, "passenger");
  const unitRunsByRow = pdfRunByRow(unitRuns);
  const passengerRunsByRow = pdfRunByRow(passengerRuns);
  const runForPdfCell = (column: number, row: number) => {
    if (column === 1) return unitRunsByRow.get(row);
    if (column === 3) return passengerRunsByRow.get(row);
    return undefined;
  };
  const head = [["DATE", "UNIT", "DESTINATION", "PASSENGER", "AMOUNT"]];
  const body = tableItems.map((item) => [
    item.date,
    item.unit || "",
    item.destination,
    item.passenger,
    money(item.amount),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    theme: "grid",
    margin: { left: 80, right: 80 },
    styles: {
      font: "helvetica",
      fontSize: 10,
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.7,
      textColor: [0, 0, 0],
      cellPadding: 6,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: 0.7,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 75 },
      2: { cellWidth: 140, halign: "center" },
      3: { cellWidth: 85 },
      4: { cellWidth: 82 },
    },
    didParseCell: (data) => {
      const run = data.section === "body" ? runForPdfCell(data.column.index, data.row.index) : undefined;
      if (run) {
        const column = data.column.index as 1 | 3;
        const lines = quoteSpanLines(
          data.doc,
          run.value,
          quoteSharedColumnWidth(column),
          data.cell.padding("horizontal"),
        );
        const minimumHeight =
          lines.length * (data.doc.getLineHeight() / data.doc.internal.scaleFactor) + data.cell.padding("vertical");
        data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight, minimumHeight);
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const cell = {
        pageNumber: data.pageNumber,
        x: data.cell.x,
        y: data.cell.y,
        width: data.cell.width,
        height: data.cell.height,
      };
      const run = runForPdfCell(data.column.index, data.row.index);
      if (run) run.cells.push(cell);
    },
    didDrawPage: (data) => {
      for (const run of [...unitRuns, ...passengerRuns]) {
        drawMergedQuoteSpan(doc, run.cells, run.value, data.pageNumber);
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let afterY = (doc as any).lastAutoTable.finalY + 14;
  const footerY = pageH - 90;

  if (input.docType === "billing" && afterY + 126 > footerY - 12) {
    doc.addPage();
    afterY = marginL;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);

  if (input.docType === "billing") {
    doc.text("********NOTHING FOLLOWS******", marginL, afterY);
    afterY += 30;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("TOTAL AMOUNT DUE:", marginL, afterY);
    const total = input.items.reduce((s, i) => s + i.amount, 0);
    doc.text(money(total), marginL + 220, afterY);
    afterY += 34;
    if (signature) {
      doc.addImage(signature.data, signature.format, marginL + 220, afterY - 30, 120, 80);
    }
    doc.setFontSize(10);
    doc.text("PAYMENT DETAILS:", marginL, afterY); afterY += lineGap;
    doc.text("PLEASE DEPOSIT PAYMENT TO:", marginL, afterY); afterY += lineGap;
    doc.text("BANK: BANK OF THE PHILIPPINE ISLAND", marginL, afterY); afterY += lineGap;
    doc.text("ACCOUNT NAME: TEDDY T. DIMATE, JR.", marginL, afterY); afterY += lineGap;
    doc.text("ACCOUNT NUMBER: 1849095435", marginL, afterY);
  } else {
    doc.setFont("helvetica", "italic");
    doc.text("* Note: Additional booked trips will incur additional costs.", marginL, afterY);
    afterY += lineGap;
    doc.setFont("helvetica", "normal");
    doc.text("Rates are still subject to change.", marginL, afterY);
    afterY += 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ESTIMATED TOTAL:", marginL, afterY);
    doc.setFont("helvetica", "normal");
    const total = input.items.reduce((s, i) => s + i.amount, 0);
    doc.text(money(total), marginL + 220, afterY);
  }

  // Footer
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("TDA CAR RENTAL SERVICES", pageW / 2, footerY, { align: "center" });
  doc.setFontSize(12);
  doc.text("+63 933 663 4655 / +63 966 583 533", pageW / 2, footerY + 18, { align: "center" });
  doc.text("tdacarrental@gmail.com", pageW / 2, footerY + 36, { align: "center" });

  return doc;
}
