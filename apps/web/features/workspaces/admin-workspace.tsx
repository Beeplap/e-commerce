"use client";

import { useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ApiErrorState, LoadingState } from "@/components/ui/primitives";
import { authApi } from "@/lib/api/client";
import { useApiQuery } from "@/lib/api/use-api-query";
import { hasPlatformPermission } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "./forbidden-screen";
import { WorkspaceFrame } from "./workspace-frame";

export function AdminWorkspace({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const pathname = usePathname();
  const user = state.kind === "authenticated" ? state.user : null;
  const allowed = hasPlatformPermission(user, "platform.access");
  const load = useCallback(
    (signal: AbortSignal) => authApi.platformAccess(signal),
    [],
  );
  const access = useApiQuery(
    allowed && user ? `${user.id}:${pathname}` : null,
    load,
  );
  if (!allowed) return <ForbiddenScreen />;
  if (access.kind === "error") {
    if (access.error.status === 403) return <ForbiddenScreen />;
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ApiErrorState error={access.error} onRetry={access.retry} />
      </div>
    );
  }
  if (access.kind === "loading") return <LoadingState />;
  return <WorkspaceFrame mode="admin">{children}</WorkspaceFrame>;
}
