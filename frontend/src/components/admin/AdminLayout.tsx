import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, LayoutDashboard, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useWorkspaceContext } from "@/components/auth/AuthGate";
import { AdminAccessGuard } from "./AdminAccessGuard";

const tabs = [
  { to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
  { to: "/admin/api-docs", label: "API Documentation", icon: BookOpen },
  { to: "/admin/users", label: "User Management", icon: Users },
  { to: "/admin/settings", label: "Workspace Settings", icon: Settings, ownerOnly: true },
] as const;

export function AdminLayout({ title, requiredRole, children }: { title: string; requiredRole?: "owner"; children: ReactNode }) {
  const context = useWorkspaceContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AdminAccessGuard requiredRole={requiredRole}>
      <AppLayout title={title}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Administration</p>
              <p className="mt-1 text-sm text-muted-foreground">{context.workspaceName}</p>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-1.5 text-xs font-medium capitalize text-muted-foreground">{context.role}</div>
          </div>
          <nav aria-label="Administration" className="-mb-px flex gap-1 overflow-x-auto border-b" role="tablist">
            {tabs.filter((tab) => !tab.ownerOnly || context.role === "owner").map((tab) => {
              const Icon = tab.icon;
              const active = pathname === tab.to;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  role="tab"
                  aria-selected={active}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          {children}
        </div>
      </AppLayout>
    </AdminAccessGuard>
  );
}
