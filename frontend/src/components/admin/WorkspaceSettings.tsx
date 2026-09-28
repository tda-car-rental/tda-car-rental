import { KeyRound, ShieldCheck } from "lucide-react";
import { useWorkspaceContext } from "@/components/auth/AuthGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkspaceSettings() {
  const context = useWorkspaceContext();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Owner-only workspace controls and safe configuration status.</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Workspace Settings</h2>
      </div>
      <Card>
        <CardHeader><CardTitle>Workspace identity</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace name</dt><dd className="mt-1 text-sm font-medium">{context.workspaceName}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace ID</dt><dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{context.workspaceId}</dd></div>
          </dl>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <StatusCard icon={ShieldCheck} title="Role policy" value="Owner controls enabled" detail="Administrator access is limited to the shared administration tabs." />
        <StatusCard icon={KeyRound} title="Document protection" value="Encrypted cloud storage" detail="Encryption keys and service credentials are never returned to the client." />
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, title, value, detail }: { icon: typeof ShieldCheck; title: string; value: string; detail: string }) {
  return <Card><CardHeader className="flex-row items-start justify-between space-y-0"><CardTitle className="text-sm">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-sm font-medium">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></CardContent></Card>;
}
