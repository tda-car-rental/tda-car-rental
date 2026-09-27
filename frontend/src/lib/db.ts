import { documentStore } from "./document-runtime";

export type DocType = "billing" | "quotation" | "acknowledgement";

export interface DocRow {
  id: string | number;
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
  updated_at?: string;
  revision?: number;
  workspace_id?: string;
}

export interface Item {
  date: string;
  destination: string;
  passenger: string;
  unit?: string;
  amount: number;
}

export type DocumentInput = Omit<DocRow, "id" | "created_at" | "updated_at" | "revision" | "workspace_id">;

export async function saveDoc(input: DocumentInput): Promise<string | number> {
  return documentStore().save(input);
}

export async function getDoc(id: string | number): Promise<DocRow | undefined> {
  return documentStore().get(id);
}

export async function updateDoc(id: string | number, input: DocumentInput): Promise<void> {
  await documentStore().update(id, input);
}

export async function listDocs(): Promise<DocRow[]> {
  return documentStore().list();
}

export async function deleteDoc(id: string | number): Promise<void> {
  await documentStore().delete(id);
}
