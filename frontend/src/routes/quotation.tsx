import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DocList } from "@/components/DocList";

export const Route = createFileRoute("/quotation")({
  head: () => ({
    meta: [
      { title: "Quotations — TDA Car Rental" },
      { name: "description", content: "Manage TDA Car Rental quotation requests and export them as PDFs." },
      { property: "og:title", content: "TDA Quotations" },
      { property: "og:description", content: "Manage quotation requests and export them as PDFs." },
    ],
  }),
  component: () => (
    <AppLayout title="Quotations">
      <DocList docType="quotation" />
    </AppLayout>
  ),
});
