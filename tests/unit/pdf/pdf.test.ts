import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePdf } from "@/lib/pdf";

const input = {
  docType: "billing" as const,
  date: "14 June 2026",
  billedTo: "Path Foundation",
  unit: "Sedan",
  driver: "Teddy Dimate",
  items: [],
};
const signatureName = (() => {
  try {
    return readdirSync("signature").find((name) => /\.(jpe?g|png)$/i.test(name));
  } catch {
    return undefined;
  }
})();
const signatureTest = signatureName ? it : it.skip;
const noSignatureTest = signatureName ? it.skip : it;

type TableCell = {
  text: string[];
  x: number;
  y: number;
  width: number;
  height: number;
};
type GeneratedTable = {
  head: Array<{ cells: Record<number, TableCell> }>;
  body: Array<{ cells: Record<number, TableCell> }>;
};

function generatedTable(pdf: Awaited<ReturnType<typeof generatePdf>>): GeneratedTable {
  return (pdf as unknown as { lastAutoTable: GeneratedTable }).lastAutoTable;
}

function textPosition(output: string, text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`([\\d.]+) ([\\d.]+) Td\\n\\(${escaped}\\) Tj`));
  expect(match).not.toBeNull();
  return { x: Number(match![1]), y: Number(match![2]) };
}

function textPositions(output: string, text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...output.matchAll(new RegExp(`([\\d.]+) ([\\d.]+) Td\\n\\(${escaped}\\) Tj`, "g"))].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

describe("generatePdf", () => {
  beforeEach(async () => {
    const britannicBold = await readFile("public/Britannic Bold Regular.ttf");
    const signature = signatureName ? await readFile(`signature/${signatureName}`) : undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/Britannic%20Bold%20Regular.ttf") {
          return Promise.resolve(new Response(britannicBold));
        }
        return Promise.resolve(new Response(signature, { status: signature ? 200 : 404 }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers Britannic Bold for the generated document header", async () => {
    const pdf = await generatePdf(input);

    expect(fetch).toHaveBeenCalledWith("/Britannic%20Bold%20Regular.ttf");
    expect(pdf.getFontList()["Britannic Bold"]).toContain("normal");
  });

  it("leaves the footer in a bold non-italic Times face", async () => {
    const pdf = await generatePdf(input);

    expect(pdf.internal.getFont()).toMatchObject({
      fontName: "times",
      fontStyle: "bold",
    });
  });

  signatureTest("embeds the local signature beside billing payment details", async () => {
    const pdf = await generatePdf(input);

    expect(pdf.output()).toContain("/Subtype /Image");
  });

  noSignatureTest("generates billing PDFs without a local signature", async () => {
    const pdf = await generatePdf(input);

    expect(pdf.output()).not.toContain("/Subtype /Image");
  });

  it("does not embed the signature in quotation PDFs", async () => {
    const pdf = await generatePdf({ ...input, docType: "quotation" });

    expect(pdf.output()).not.toContain("/Subtype /Image");
  });

  signatureTest("renders acknowledgement receipts with the local signature", async () => {
    const pdf = await generatePdf({
      docType: "acknowledgement",
      date: "26-Jul-26",
      refNo: "004",
      amount: 5000,
      details: "July 25, 2026 Easy Park office to Park Inn Hotel, Clark",
      receivedBy: "Easy Park Office - SBFZ",
      dateReceived: "26-Jul-26",
    });

    expect(pdf.output()).toContain("/Subtype /Image");
    expect(pdf.output()).toContain("Acknowledgment Receipt");
  });

  it("renders billing Units from line items with shared merged spans", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "billing",
      unit: "Toyota HiAce",
      items: [
        { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
        { date: "2026-06-12", unit: "Toyota HiAce", destination: "Olongapo", passenger: "A. Cruz", amount: 900 },
      ],
    });
    const table = generatedTable(pdf);
    const output = pdf.output();

    expect([0, 1, 2, 3, 4].map((index) => table.head[0].cells[index].text[0])).toEqual([
      "DATE", "UNIT", "DESTINATION", "PASSENGER", "AMOUNT",
    ]);
    expect([0, 1, 2, 3, 4].map((index) => table.head[0].cells[index].width)).toEqual([
      70, 75, 140, 85, 82,
    ]);
    expect(table.head[0].cells[0].x).toBe(80);
    expect(table.head[0].cells[4].x + table.head[0].cells[4].width).toBe(532);
    expect(table.body.map((row) => row.cells[1].text)).toEqual([[], []]);
    expect(table.body.map((row) => row.cells[3].text)).toEqual([[], []]);
    expect(textPositions(output, "Toyota HiAce")).toHaveLength(1);
    expect(textPositions(output, "A. Cruz")).toHaveLength(1);
    expect(output).not.toContain("(Unit Used: Toyota HiAce) Tj");
    expect(output).not.toContain("(Requestor:) Tj");
  });

  it.each(["billing", "quotation"] as const)(
    "merges only adjacent non-empty Unit and Passenger cells in %s PDFs",
    async (docType) => {
      const pdf = await generatePdf({
        ...input,
        docType,
        items: [
          { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
          { date: "2026-06-12", unit: "Toyota HiAce", destination: "Olongapo", passenger: "A. Cruz", amount: 900 },
          { date: "2026-06-13", unit: "Mitsubishi L300", destination: "Manila", passenger: "A. Cruz", amount: 1100 },
          { date: "2026-06-14", unit: "Toyota HiAce", destination: "Subic", passenger: "B. Reyes", amount: 1000 },
          { date: "2026-06-15", unit: "   ", destination: "Subic", passenger: "   ", amount: 1000 },
          { date: "2026-06-16", unit: "   ", destination: "Subic", passenger: "   ", amount: 1000 },
          { date: "2026-06-17", unit: "Toyota HiAce", destination: "Subic", passenger: "B. Reyes", amount: 1000 },
        ],
      });
      const table = generatedTable(pdf);
      const output = pdf.output();

      expect(table.body.slice(0, 2).map((row) => row.cells[1].text)).toEqual([[], []]);
      expect(table.body.slice(0, 3).map((row) => row.cells[3].text)).toEqual([[], [], []]);
      expect(table.body[2].cells[1].text).toEqual(["Mitsubishi", "L300"]);
      expect(table.body[3].cells[1].text).toEqual(["Toyota HiAce"]);
      expect(table.body[3].cells[3].text).toEqual(["B. Reyes"]);
      expect(table.body.slice(4, 6).map((row) => row.cells[1].text)).toEqual([["   "], ["   "]]);
      expect(table.body.slice(4, 6).map((row) => row.cells[3].text)).toEqual([["   "], ["   "]]);
      expect(table.body[6].cells[1].text).toEqual(["Toyota HiAce"]);
      expect(table.body[6].cells[3].text).toEqual(["B. Reyes"]);
      expect(textPositions(output, "Toyota HiAce")).toHaveLength(3);
      expect(textPositions(output, "A. Cruz")).toHaveLength(1);
      expect(textPositions(output, "B. Reyes")).toHaveLength(2);
    },
  );

  it("uses the legacy document unit when billing line items do not yet have one", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "billing",
      unit: "Toyota HiAce",
      items: [
        { date: "2026-06-11", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
        { date: "2026-06-12", destination: "Olongapo", passenger: "A. Cruz", amount: 900 },
      ],
    });

    expect(generatedTable(pdf).body.map((row) => row.cells[1].text)).toEqual([[], []]);
    expect(textPositions(pdf.output(), "Toyota HiAce")).toHaveLength(1);
  });

  it("renders a quotation requestor above a merged unit column", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      requestor: "Path Foundation",
      unit: "Toyota HiAce",
      items: [
        { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "2", amount: 1200 },
        { date: "2026-06-12", unit: "Toyota HiAce", destination: "Olongapo", passenger: "3", amount: 900 },
      ],
    });

    const output = pdf.output();
    const heading = textPosition(output, "QUOTATION REQUEST");
    const requestor = textPosition(output, "Requestor: Path Foundation");
    const unit = textPosition(output, "UNIT");
    const table = generatedTable(pdf);
    const unitHeader = table.head[0].cells[1];
    const firstUnitCell = table.body[0].cells[1];
    const secondUnitCell = table.body[1].cells[1];

    expect(requestor).toEqual({ x: heading.x, y: heading.y - 13 });
    expect(unitHeader.text).toEqual(["UNIT"]);
    expect(unitHeader.x).toBeGreaterThan(table.head[0].cells[0].x);
    expect(unit.x).toBeGreaterThan(heading.x);
    expect(firstUnitCell.text).toEqual([]);
    expect(secondUnitCell.text).toEqual([]);
    expect(secondUnitCell.x).toBe(firstUnitCell.x);
    expect(secondUnitCell.width).toBe(firstUnitCell.width);
    expect(output).not.toContain("(Requestor) Tj");
    expect(output).not.toContain("Unit Requested:");
  });

  it("keeps the requestor label and an empty unit body when a quotation has no line items", async () => {
    const pdf = await generatePdf({ ...input, docType: "quotation", requestor: "", items: [] });

    expect(pdf.output()).toContain("(Requestor: ) Tj");
    expect(generatedTable(pdf).head[0].cells[1].text).toEqual(["UNIT"]);
    expect(generatedTable(pdf).body).toHaveLength(0);
  });

  it("uses balanced fixed quotation columns and merges shared values only", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      items: [
        { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
        { date: "2026-06-12", unit: "Toyota HiAce", destination: "Olongapo", passenger: "A. Cruz", amount: 900 },
      ],
    });
    const table = generatedTable(pdf);

    expect([0, 1, 2, 3, 4].map((index) => table.head[0].cells[index].text[0])).toEqual([
      "DATE", "UNIT", "DESTINATION", "PASSENGER", "AMOUNT",
    ]);
    expect([0, 1, 2, 3, 4].map((index) => table.head[0].cells[index].width)).toEqual([
      70, 75, 140, 85, 82,
    ]);
    expect(table.head[0].cells[0].x).toBe(80);
    expect(table.head[0].cells[4].x + table.head[0].cells[4].width).toBe(532);
    expect(table.body[1].cells[1].text).toEqual([]);
    expect(table.body[1].cells[3].text).toEqual([]);
    expect(table.body[1].cells[0].text).toEqual(["2026-06-12"]);
    expect(table.body[1].cells[2].text).toEqual(["Olongapo"]);
    expect(table.body[1].cells[4].text).toEqual(["PHP 900.00"]);
  });

  it("centers shared quotation values across their merged cells", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      items: [
        { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
        { date: "2026-06-12", unit: "Toyota HiAce", destination: "Olongapo", passenger: "A. Cruz", amount: 900 },
      ],
    });
    const table = generatedTable(pdf);
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (const [column, value] of [[1, "Toyota HiAce"], [3, "A. Cruz"]] as const) {
      const first = table.body[0].cells[column];
      const last = table.body.at(-1)!.cells[column];
      const expected = {
        x: first.x + first.width / 2,
        y: pageHeight - (first.y + (last.y + last.height - first.y) / 2),
      };

      expect(table.body.map((row) => row.cells[column].text)).toEqual([[], []]);
      const [position] = textPositions(pdf.output(), value);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const middleBaselineOffset = pdf.getFontSize() / 2 - pdf.getFontSize() * (pdf.getLineHeightFactor() - 1);
      expect(position).toBeDefined();
      expect(Math.abs(position.x + pdf.getTextWidth(value) / 2 - expected.x)).toBeLessThan(1);
      expect(Math.abs(position.y - (expected.y - middleBaselineOffset))).toBeLessThan(1);
    }
  });

  it("wraps a long shared Unit within its merged cell", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      items: [
        { date: "2026-06-11", unit: "Mitsubishi L300", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
        { date: "2026-06-12", unit: "Mitsubishi L300", destination: "Olongapo", passenger: "B. Reyes", amount: 900 },
      ],
    });
    const table = generatedTable(pdf);
    const first = table.body[0].cells[1];
    const last = table.body.at(-1)!.cells[1];
    const expectedCenterY = pdf.internal.pageSize.getHeight() -
      (first.y + (last.y + last.height - first.y) / 2);
    const output = pdf.output();

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const middleBaselineOffset = pdf.getFontSize() / 2 - pdf.getFontSize() * (pdf.getLineHeightFactor() - 1);
    const lineHeight = pdf.getLineHeight() / pdf.internal.scaleFactor;
    const mitsubishi = textPositions(output, "Mitsubishi");

    expect(textPositions(output, "Mitsubishi L300")).toHaveLength(0);
    expect(mitsubishi).toHaveLength(1);
    expect(output).toMatch(/\(Mitsubishi\) Tj\n[\d.-]+ [\d.-]+ Td\n\(L300\) Tj/);
    expect(Math.abs(mitsubishi[0].x + pdf.getTextWidth("Mitsubishi") / 2 - (first.x + first.width / 2))).toBeLessThan(1);
    expect(Math.abs(mitsubishi[0].y - (expectedCenterY + lineHeight / 2 - middleBaselineOffset))).toBeLessThan(1);
  });

  it("reserves row height for a multi-line merged Unit", async () => {
    const unit = "Mitsubishi Fuso Rosa Deluxe";
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      items: [{ date: "2026-06-11", unit, destination: "Subic", passenger: "A. Cruz", amount: 1200 }],
    });
    const cell = generatedTable(pdf).body[0].cells[1];

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(unit, cell.width - 12);
    const requiredHeight = lines.length * (pdf.getLineHeight() / pdf.internal.scaleFactor) + 12;

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(cell.height).toBeGreaterThanOrEqual(requiredHeight);
  });

  it("renders one shared quotation label per physical table page", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      items: Array.from({ length: 40 }, (_, index) => ({
        date: `2026-06-${index + 1}`,
        unit: "Toyota HiAce",
        destination: "Olongapo City",
        passenger: "A. Cruz",
        amount: 900,
      })),
    });
    const table = generatedTable(pdf);
    const pageCount = pdf.getNumberOfPages();

    expect(pageCount).toBeGreaterThan(1);
    expect(textPositions(pdf.output(), "Toyota HiAce")).toHaveLength(pageCount);
    expect(textPositions(pdf.output(), "A. Cruz")).toHaveLength(pageCount);
    expect(table.body[0].cells[0].text).toEqual(["2026-06-1"]);
    expect(table.body.at(-1)!.cells[2].text).toEqual(["Olongapo City"]);
    expect(table.body.at(-1)!.cells[4].text).toEqual(["PHP 900.00"]);
  });

  it("keeps differing quotation units and passengers in their own rows", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      items: [
        { date: "2026-06-11", unit: "Toyota HiAce", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
        { date: "2026-06-12", unit: "Mitsubishi L300", destination: "Olongapo", passenger: "B. Reyes", amount: 900 },
      ],
    });
    const table = generatedTable(pdf);

    expect(table.body[1].cells[1].text).toEqual(["Mitsubishi", "L300"]);
    expect(table.body[1].cells[3].text).toEqual(["B. Reyes"]);
  });

  it("uses the legacy document unit when quotation line items do not yet have one", async () => {
    const pdf = await generatePdf({
      ...input,
      docType: "quotation",
      unit: "Toyota HiAce",
      items: [
        { date: "2026-06-11", destination: "Subic", passenger: "A. Cruz", amount: 1200 },
        { date: "2026-06-12", destination: "Olongapo", passenger: "A. Cruz", amount: 900 },
      ],
    });
    const table = generatedTable(pdf);

    expect(table.body[0].cells[1].text).toEqual([]);
    expect(table.body[1].cells[1].text).toEqual([]);
    expect(textPositions(pdf.output(), "Toyota HiAce")).toHaveLength(1);
  });

  it("moves billing totals and payment details to a new page before the footer", async () => {
    const pdf = await generatePdf({
      ...input,
      items: Array.from({ length: 12 }, (_, index) => ({
        date: `2026-06-${index + 1}`,
        destination: "Olongapo City",
        passenger: "1",
        amount: 100,
      })),
    });

    expect(pdf.getNumberOfPages()).toBe(2);
  });
});
