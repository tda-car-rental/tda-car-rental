import { useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiOperations } from "@/lib/api-docs";

export function ApiDocumentation() {
  const [selectedId, setSelectedId] = useState(apiOperations[0]?.id ?? "");
  const selected = apiOperations.find((operation) => operation.id === selectedId) ?? apiOperations[0];
  if (!selected) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">A read-only reference for the authenticated client contract.</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">API Documentation</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Operations</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {apiOperations.map((operation) => (
              <button key={operation.id} type="button" onClick={() => setSelectedId(operation.id)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${selected.id === operation.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <span><span className="mr-2 font-mono text-[11px]">{operation.method}</span>{operation.path}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{selected.method}</Badge><code className="text-sm">{selected.path}</code></div>
            <CardTitle className="mt-2 text-lg">{selected.summary}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Detail label="Authentication" value={selected.authentication} />
            <Detail label="Workspace scope" value={selected.workspace} />
            <Detail label="Request" value={selected.request} code />
            <Detail label="Response" value={selected.response} code />
            <div><h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expected errors</h3><ul className="mt-2 space-y-1 text-sm text-muted-foreground">{selected.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>
            <p className="border-t pt-4 text-xs text-muted-foreground">This reference does not execute requests. Client authentication, workspace scope, role checks, and encrypted document handling remain enforced by the Edge Functions.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value, code = false }: { label: string; value: string; code?: boolean }) {
  return <div><h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</h3><p className={`mt-2 text-sm text-foreground ${code ? "rounded-md bg-muted p-3 font-mono text-xs" : ""}`}>{value}</p></div>;
}
