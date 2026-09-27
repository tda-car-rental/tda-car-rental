import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LoginPage } from "./LoginPage";
import type { AuthState } from "@/lib/auth";
import type { WorkspaceContext } from "@/lib/cloud-types";

type AuthLike = {
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;
  start(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
};

type ApiLike = { getWorkspaceContext(): Promise<WorkspaceContext> };

const workspaceContext = createContext<WorkspaceContext | null>(null);

export function useWorkspaceContext(): WorkspaceContext {
  const context = useContext(workspaceContext);
  if (!context) throw new Error("Workspace context is required.");
  return context;
}

export function WorkspaceContextProvider({ value, children }: { value: WorkspaceContext; children: ReactNode }) {
  return <workspaceContext.Provider value={value}>{children}</workspaceContext.Provider>;
}

export function AuthGate({ auth, api, children }: { auth: AuthLike; api: ApiLike; children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(auth.getState());
  const [context, setContext] = useState<WorkspaceContext>();
  const [contextError, setContextError] = useState<string>();

  useEffect(() => {
    const unsubscribe = auth.subscribe(setAuthState);
    void auth.start();
    return unsubscribe;
  }, [auth]);

  useEffect(() => {
    if (authState.status !== "signed-in") {
      setContext(undefined);
      setContextError(undefined);
      return;
    }
    let active = true;
    setContextError(undefined);
    void api.getWorkspaceContext().then((next) => {
      if (active) setContext(next);
    }).catch(() => {
      if (active) setContextError("Workspace access is unavailable.");
    });
    return () => { active = false; };
  }, [api, authState.status]);

  if (authState.status === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }
  if (authState.status === "signed-out" || authState.status === "error") {
    return <LoginPage onSignIn={auth.signIn} error={authState.status === "error" ? authState.message : undefined} />;
  }
  if (authState.status === "offline-authenticated") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Offline workspace access is not available on this device.</div>;
  }
  if (contextError) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-destructive">{contextError}</div>;
  }
  if (!context) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading workspace...</div>;
  }
  return <WorkspaceContextProvider value={context}>{children}</WorkspaceContextProvider>;
}
