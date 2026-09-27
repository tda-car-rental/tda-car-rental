import type { ReactNode } from "react";
import { useWorkspaceContext } from "./AuthGate";
import type { CloudRole } from "@/lib/cloud-types";

type Capability = keyof ReturnType<typeof useWorkspaceContext>["capabilities"];

export function RoleGate({
  roles,
  capability,
  fallback = null,
  children,
}: {
  roles?: CloudRole[];
  capability?: Capability;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const context = useWorkspaceContext();
  const roleAllowed = !roles || roles.includes(context.role);
  const capabilityAllowed = !capability || context.capabilities[capability];
  return roleAllowed && capabilityAllowed ? children : fallback;
}
