import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { UserManagement } from "@/components/admin/UserManagement";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User Management — TDA Car Rental" },
      { name: "description", content: "Manage TDA Car Rental workspace accounts." },
    ],
  }),
  component: () => (
    <AdminLayout title="User Management">
      <UserManagement />
    </AdminLayout>
  ),
});
