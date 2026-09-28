import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useCallback, useMemo, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthGate } from "@/components/auth/AuthGate";
import { createSupabaseAuthClient, createAuthController } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/config";
import { createCloudApi } from "@/lib/cloud-api";
import { createIndexedDbBlobStore } from "@/lib/browser-cache";
import { createDeviceKeyProvider, createEncryptedLocalCache, createRawDeviceKeyProvider, type DeviceKeyProvider } from "@/lib/local-cache";
import { createCloudDocumentStore } from "@/lib/document-store";
import { clearDocumentStore, configureDocumentStore } from "@/lib/document-runtime";
import type { WorkspaceContext } from "@/lib/cloud-types";

import appCss from "../styles.css?url";

const cachedContextKey = "tda.cached-workspace-context";

function readCachedWorkspaceContext(): WorkspaceContext | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(cachedContextKey) ?? "null") as WorkspaceContext | null;
    return value?.workspaceId && value.workspaceName && value.role ? value : null;
  } catch {
    return null;
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TDA Car Rental" },
      { name: "description", content: "Vehicle rental management for TDA Car Rental." },
      { property: "og:title", content: "TDA Car Rental" },
      { property: "og:description", content: "Vehicle rental management for TDA Car Rental." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/icon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const runtime = useMemo(() => {
    if (import.meta.env.MODE === "test") return null;
    try {
      const config = getSupabaseConfig();
      const authClient = createSupabaseAuthClient(config);
      let cleanupSensitiveState: () => void | Promise<void> = () => undefined;
      const auth = createAuthController({
        client: authClient,
        hasCachedSession: async () => typeof window !== "undefined" && Object.keys(window.localStorage).some((key) => key.includes("auth-token")),
        clearSensitiveState: () => cleanupSensitiveState(),
      });
      const api = createCloudApi({
        baseUrl: `${config.url}/functions/v1`,
        getAccessToken: () => auth.getAccessToken(),
      });
      return { auth, api, registerCleanup: (cleanup: () => void | Promise<void>) => { cleanupSensitiveState = cleanup; } };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Cloud service configuration is unavailable." };
    }
  }, []);

  const onWorkspaceReady = useCallback(async (context: WorkspaceContext) => {
    if (!runtime || "error" in runtime) return;
    window.localStorage.setItem(cachedContextKey, JSON.stringify(context));
    let keyProvider: DeviceKeyProvider;
    if (typeof window !== "undefined" && window.tda?.deviceKey) {
      keyProvider = createRawDeviceKeyProvider(() => window.tda.deviceKey.get());
    } else {
      keyProvider = createDeviceKeyProvider();
    }
    const blobStore = createIndexedDbBlobStore();
    const cache = createEncryptedLocalCache(blobStore, keyProvider);
    configureDocumentStore(createCloudDocumentStore({ api: runtime.api, workspaceId: context.workspaceId, cache }));
    runtime.registerCleanup(async () => {
      await cache.clear();
      keyProvider.clear();
      clearDocumentStore();
      window.localStorage.removeItem(cachedContextKey);
    });
  }, [runtime]);

  return (
    <QueryClientProvider client={queryClient}>
      {runtime === null ? (
        <Outlet />
      ) : "error" in runtime ? (
        <div className="flex min-h-screen items-center justify-center text-sm text-destructive">{runtime.error}</div>
      ) : (
          <AuthGate auth={runtime.auth} api={runtime.api} cloudApi={runtime.api} getCachedWorkspaceContext={async () => readCachedWorkspaceContext()} onWorkspaceReady={onWorkspaceReady}>
          <Outlet />
        </AuthGate>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}
