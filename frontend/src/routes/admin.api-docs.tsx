import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ApiDocumentation } from "@/components/admin/ApiDocumentation";

export const Route = createFileRoute("/admin/api-docs")({
  head: () => ({ meta: [{ title: "API Documentation — TDA Car Rental" }, { name: "description", content: "Read-only Edge Function API documentation for TDA Car Rental." }] }),
  component: () => <AdminLayout title="API Documentation"><ApiDocumentation /></AdminLayout>,
});
