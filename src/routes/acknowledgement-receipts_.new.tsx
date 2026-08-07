import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/acknowledgement-receipts_/new")({
  component: () => <DocumentEditorPage docType="acknowledgement" />,
});
