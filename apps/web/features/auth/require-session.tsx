"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  ApiErrorState,
  LoadingState,
  secondaryButton,
} from "@/components/ui/primitives";
import { useAuth } from "./auth-provider";

export function RequireSession({ children }: { children: ReactNode }) {
  const { state, refresh } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.kind === "anonymous") router.replace("/login");
  }, [state.kind, router]);
  if (state.kind === "loading") return <LoadingState />;
  if (state.kind === "error")
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ApiErrorState error={state.error} onRetry={() => void refresh()} />
      </div>
    );
  if (state.kind === "anonymous")
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-4 text-xl font-semibold">Sign in to continue</h1>
        <Link className={secondaryButton} href="/login">
          Sign in
        </Link>
      </main>
    );
  return children;
}
