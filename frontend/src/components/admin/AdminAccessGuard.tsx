import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useWorkspaceContext } from "@/components/auth/AuthGate";
import type { CloudRole } from "@/lib/cloud-types";

export function AdminAccessGuard({ requiredRole, children }: { requiredRole?: CloudRole; children: ReactNode }) {
  const context = useWorkspaceContext();
  const allowed = requiredRole
    ? context.role === requiredRole
    : context.role === "owner" || context.role === "administrator";

  if (allowed) return children;

  return (
    <AppLayout title="Access denied">
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold">This area is restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your workspace role does not have access to this administration page.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Return to Dashboard</Link>
      </div>
    </AppLayout>
  );
}
