import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DocList } from "@/components/DocList";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billings — TDA Car Rental" },
      { name: "description", content: "Manage TDA Car Rental billing statements and export them as PDFs." },
      { property: "og:title", content: "TDA Billings" },
      { property: "og:description", content: "Manage billing statements and export them as PDFs." },
    ],
  }),
  component: () => (
    <AppLayout title="Billings">
      <DocList docType="billing" />
    </AppLayout>
  ),
});
