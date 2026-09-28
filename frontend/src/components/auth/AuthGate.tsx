import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LoginPage } from "./LoginPage";
import type { AuthState } from "@/lib/auth";
import type { WorkspaceContext } from "@/lib/cloud-types";
import type { CloudApi } from "@/lib/cloud-api";

type AuthLike = {
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;
  start(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
};

type ApiLike = { getWorkspaceContext(): Promise<WorkspaceContext> };

const workspaceContext = createContext<WorkspaceContext | null>(null);
const cloudApiContext = createContext<CloudApi | null>(null);

export function useWorkspaceContext(): WorkspaceContext {
  const context = useContext(workspaceContext);
  if (!context) throw new Error("Workspace context is required.");
  return context;
}

export function useOptionalWorkspaceContext(): WorkspaceContext | null {
  return useContext(workspaceContext);
}

export function useCloudApi(): CloudApi {
  const api = useContext(cloudApiContext);
  if (!api) throw new Error("Cloud API is required.");
  return api;
}

export function WorkspaceContextProvider({ value, children }: { value: WorkspaceContext; children: ReactNode }) {
  return <workspaceContext.Provider value={value}>{children}</workspaceContext.Provider>;
}

export function AuthGate({ auth, api, cloudApi, getCachedWorkspaceContext, onWorkspaceReady, children }: { auth: AuthLike; api: ApiLike; cloudApi?: CloudApi; getCachedWorkspaceContext?: () => Promise<WorkspaceContext | null>; onWorkspaceReady?: (context: WorkspaceContext) => void; children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(auth.getState());
  const [context, setContext] = useState<WorkspaceContext>();
  const [contextError, setContextError] = useState<string>();

  useEffect(() => {
    const unsubscribe = auth.subscribe(setAuthState);
    void auth.start();
    return unsubscribe;
  }, [auth]);

  useEffect(() => {
    if (authState.status === "signed-out" || authState.status === "error") {
      setContext(undefined);
      setContextError(undefined);
      return;
    }
    if (authState.status === "offline-authenticated") {
      let active = true;
      const cachedContext = getCachedWorkspaceContext?.() ?? Promise.resolve(null);
      void cachedContext.then((next) => {
        if (!active) return;
        if (!next) setContextError("Offline workspace access is unavailable.");
        else {
          setContext(next);
          onWorkspaceReady?.(next);
        }
      });
      return () => { active = false; };
    }
    let active = true;
    setContextError(undefined);
    void api.getWorkspaceContext().then((next) => {
      if (active) {
        setContext(next);
        onWorkspaceReady?.(next);
      }
    }).catch(() => {
      if (active) setContextError("Workspace access is unavailable.");
    });
    return () => { active = false; };
  }, [api, authState.status, getCachedWorkspaceContext, onWorkspaceReady]);

  if (authState.status === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }
  if (authState.status === "signed-out" || authState.status === "error") {
    return <LoginPage onSignIn={auth.signIn} error={authState.status === "error" ? authState.message : undefined} />;
  }
  if (contextError) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-destructive">{contextError}</div>;
  }
  if (!context) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{authState.status === "offline-authenticated" ? "Opening offline workspace..." : "Loading workspace..."}</div>;
  }
  return <WorkspaceContextProvider value={context}><cloudApiContext.Provider value={cloudApi ?? null}>{children}</cloudApiContext.Provider></WorkspaceContextProvider>;
}
