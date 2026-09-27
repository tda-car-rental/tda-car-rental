import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/billing_/$id/edit")({
  component: BillingEditPage,
});

function BillingEditPage() {
  const { id } = Route.useParams();
  return <DocumentEditorPage docType="billing" documentId={Number(id)} />;
}
