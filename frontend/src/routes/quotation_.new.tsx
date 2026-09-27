import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/quotation_/new")({
  component: () => <DocumentEditorPage docType="quotation" />,
});
