import { electronApi } from "./electron-api";

export type DocType = "billing" | "quotation" | "acknowledgement";

export interface DocRow {
  id: number;
  doc_type: DocType;
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
  created_at: string;
}

export interface Item {
  date: string;
  destination: string;
  passenger: string;
  unit?: string;
  amount: number;
}

export type DocumentInput = Omit<DocRow, "id" | "created_at">;

export async function saveDoc(input: DocumentInput): Promise<number> {
  return electronApi().documents.save(input);
}

export async function getDoc(id: number): Promise<DocRow | undefined> {
  return electronApi().documents.get(id);
}

export async function updateDoc(id: number, input: DocumentInput): Promise<void> {
  await electronApi().documents.update(id, input);
}

export async function listDocs(): Promise<DocRow[]> {
  return electronApi().documents.list();
}

export async function deleteDoc(id: number): Promise<void> {
  await electronApi().documents.delete(id);
}
