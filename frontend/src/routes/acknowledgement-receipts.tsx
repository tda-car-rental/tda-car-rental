import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DocList } from "@/components/DocList";

export const Route = createFileRoute("/acknowledgement-receipts")({
  head: () => ({
    meta: [
      { title: "Acknowledgement Receipts — TDA Car Rental" },
      { name: "description", content: "Manage TDA Car Rental acknowledgement receipts and export them as PDFs." },
      { property: "og:title", content: "TDA Acknowledgement Receipts" },
      { property: "og:description", content: "Manage acknowledgement receipts and export them as PDFs." },
    ],
  }),
  component: () => (
    <AppLayout title="Acknowledgement Receipts">
      <DocList docType="acknowledgement" />
    </AppLayout>
  ),
});
