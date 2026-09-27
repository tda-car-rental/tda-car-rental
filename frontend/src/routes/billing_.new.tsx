import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/billing_/new")({
  component: () => <DocumentEditorPage docType="billing" />,
});
