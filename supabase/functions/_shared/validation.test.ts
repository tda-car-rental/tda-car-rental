import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDocumentInput } from "./validation.ts";

const validInput = {
  doc_type: "billing",
  doc_date: "2026-09-27",
  billed_to: "TDA Car Rental",
  unit: "SUV-01",
  driver: "Driver",
  requestor: "Requester",
  total: 1250,
  items_json: JSON.stringify([{ date: "2026-09-27", amount: 1250 }]),
  ack_ref_no: "",
  ack_amount: 0,
  ack_details: "",
  ack_received_by: "",
  ack_date_received: "",
};

test("document validation returns the normalized allowed payload", () => {
  assert.deepEqual(validateDocumentInput(validInput), validInput);
});

test("document validation rejects unknown document kinds", () => {
  assert.throws(() => validateDocumentInput({ ...validInput, doc_type: "secret" }), /invalid document kind/i);
});

test("document validation rejects non-finite totals and malformed item JSON", () => {
  assert.throws(() => validateDocumentInput({ ...validInput, total: Number.NaN }), /total/i);
  assert.throws(() => validateDocumentInput({ ...validInput, items_json: "not-json" }), /items_json/i);
});

test("document validation rejects oversized strings", () => {
  assert.throws(() => validateDocumentInput({ ...validInput, billed_to: "x".repeat(501) }), /billed_to/i);
});
