import { ShieldCheck, Users, WalletCards } from "lucide-react";
import { useWorkspaceContext } from "@/components/auth/AuthGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminDashboard() {
  const context = useWorkspaceContext();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Operational overview for the authenticated workspace.</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Admin Dashboard</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard icon={ShieldCheck} title="Access level" value={context.role} detail="Role is enforced by the cloud service." />
        <InfoCard icon={Users} title="Member management" value={context.capabilities.canManageMembers ? "Enabled" : "Restricted"} detail="Invite, role, and status actions use the members function." />
        <InfoCard icon={WalletCards} title="Document access" value={context.capabilities.canWriteContracts ? "Full workspace" : "Financial documents"} detail="Sensitive document contents remain encrypted at rest." />
      </div>
      <Card>
        <CardHeader><CardTitle>Workspace</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace name</dt><dd className="mt-1 text-sm font-medium">{context.workspaceName}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace ID</dt><dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{context.workspaceId}</dd></div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ icon: Icon, title, value, detail }: { icon: typeof ShieldCheck; title: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0"><CardTitle className="text-sm">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader>
      <CardContent><div className="text-xl font-semibold capitalize">{value}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></CardContent>
    </Card>
  );
}
