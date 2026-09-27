import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ContractEditor } from "@/components/ContractEditor";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [
      { name: "description", content: "Upload, fill, and sign PDF contracts for TDA Car Rental." },
      { property: "og:description", content: "Upload, fill, and sign PDF contracts." },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  return (
    <AppLayout title="Contracts">
      <ContractEditor />
    </AppLayout>
  );
}
