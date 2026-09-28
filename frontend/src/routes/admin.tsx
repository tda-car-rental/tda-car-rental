import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLayout } from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — TDA Car Rental" }, { name: "description", content: "Workspace administration overview for TDA Car Rental." }] }),
  component: () => <AdminLayout title="Admin Dashboard"><AdminDashboard /></AdminLayout>,
});
