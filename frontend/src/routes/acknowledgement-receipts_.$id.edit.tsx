import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/acknowledgement-receipts_/$id/edit")({
  component: AcknowledgementEditPage,
});

function AcknowledgementEditPage() {
  const { id } = Route.useParams();
  return <DocumentEditorPage docType="acknowledgement" documentId={Number(id)} />;
}
