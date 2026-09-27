export type DocumentKind = "billing" | "quotation" | "acknowledgement" | "contract";

export type DocumentInput = {
  doc_type: DocumentKind;
  doc_date: string;
  billed_to: string;
  unit: string;
  driver: string;
  requestor: string;
  total: number;
  items_json: string;
  ack_ref_no: string;
  ack_amount: number;
  ack_details: string;
  ack_received_by: string;
  ack_date_received: string;
};

const documentKinds = new Set<DocumentKind>(["billing", "quotation", "acknowledgement", "contract"]);
const stringLimits: Record<string, number> = {
  doc_date: 40,
  billed_to: 500,
  unit: 200,
  driver: 500,
  requestor: 500,
  ack_ref_no: 200,
  ack_details: 2000,
  ack_received_by: 500,
  ack_date_received: 40,
};

function invalid(field: string): never {
  throw new Error(`Invalid ${field}.`);
}

export function validateDocumentInput(value: unknown): DocumentInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("document data");
  const input = value as Record<string, unknown>;

  if (typeof input.doc_type !== "string" || !documentKinds.has(input.doc_type as DocumentKind)) {
    invalid("document kind");
  }

  for (const [field, limit] of Object.entries(stringLimits)) {
    if (typeof input[field] !== "string" || input[field].length > limit) invalid(field);
    if ((field === "doc_date" || field === "doc_type") && input[field].trim().length === 0) invalid(field);
  }

  if (typeof input.items_json !== "string" || input.items_json.length > 100_000) invalid("items_json");
  try {
    const items = JSON.parse(input.items_json || "[]") as unknown;
    if (!Array.isArray(items) || items.length > 1000) invalid("items_json");
  } catch {
    invalid("items_json");
  }

  if (typeof input.total !== "number" || !Number.isFinite(input.total) || input.total < 0) invalid("total");
  if (
    typeof input.ack_amount !== "number" ||
    !Number.isFinite(input.ack_amount) ||
    input.ack_amount < 0
  ) {
    invalid("ack_amount");
  }

  return {
    doc_type: input.doc_type as DocumentKind,
    doc_date: input.doc_date as string,
    billed_to: input.billed_to as string,
    unit: input.unit as string,
    driver: input.driver as string,
    requestor: input.requestor as string,
    total: input.total as number,
    items_json: input.items_json as string,
    ack_ref_no: input.ack_ref_no as string,
    ack_amount: input.ack_amount as number,
    ack_details: input.ack_details as string,
    ack_received_by: input.ack_received_by as string,
    ack_date_received: input.ack_date_received as string,
  };
}
