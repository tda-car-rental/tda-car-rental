export type CloudRole = "owner" | "administrator" | "bookkeeper";
export type CloudMemberRole = Exclude<CloudRole, "owner">;
export type CloudDocumentKind = "billing" | "quotation" | "acknowledgement" | "contract";

export type CloudDocumentInput = {
  doc_type: CloudDocumentKind;
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

export type CloudDocument = CloudDocumentInput & {
  id: string;
  workspace_id: string;
  revision: number;
  updated_at: string;
  created_at: string;
};

export type DocumentCursor = {
  updatedAt: string;
  id: string;
};

export type DocumentPage = {
  documents: CloudDocument[];
  nextCursor: DocumentCursor | null;
};

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  role: CloudRole;
  capabilities: {
    canAccessAdmin: boolean;
    canManageMembers: boolean;
    canManageWorkspaceSettings: boolean;
    canWriteContracts: boolean;
  };
};

export type DocumentSummary = {
  counts: Record<CloudDocumentKind, number>;
  monthlyTotals: Array<{ month: string; billing: number; quotation: number; acknowledgement: number }>;
};

export type MemberCursor = {
  createdAt: string;
  userId: string;
};

export type CloudMemberSummary = {
  userId: string;
  email: string | null;
  role: CloudRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemberPage = {
  members: CloudMemberSummary[];
  nextCursor: string | null;
};
