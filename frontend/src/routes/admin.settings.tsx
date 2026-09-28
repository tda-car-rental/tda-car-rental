import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { WorkspaceSettings } from "@/components/admin/WorkspaceSettings";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Workspace Settings — TDA Car Rental" }, { name: "description", content: "Owner-only workspace settings for TDA Car Rental." }] }),
  component: () => <AdminLayout title="Workspace Settings" requiredRole="owner"><WorkspaceSettings /></AdminLayout>,
});
