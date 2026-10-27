"use client";
import { useEffect, useState } from "react";
import { paymentsApi, errorMessage } from "@/lib/api/client";
import { useAuth } from "../auth/auth-provider";
import { placedEvidence, type OrderEvidence } from "./evidence";

export function useOrderRead(id: string | null, skip: boolean) {
  const { state } = useAuth();
  const owner = state.kind === "authenticated" ? state.user.id : state.kind;
  const key = `${owner}:${id}`;
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{
    key: string;
    kind: "loading" | "ready" | "error";
    order: OrderEvidence | null;
    error?: string;
  } | null>(null);
  // Clear prior private evidence on every identity/route transition, including
  // guest -> signed in -> guest where the final textual key can repeat.
  if (read && read.key !== key) setRead(null);
  useEffect(() => {
    if (!id || !["authenticated", "anonymous"].includes(state.kind) || skip)
      return;
    const controller = new AbortController();
    const load = async () => {
      setRead({ key, kind: "loading", order: null });
      try {
        const result = await paymentsApi.orderState(id, controller.signal);
        const order = placedEvidence(result);
        order.cancelled = result.fulfillment_status === "cancelled";
        order.processing = result.payment?.status === "authorized";
        if (!controller.signal.aborted) setRead({ key, kind: "ready", order });
      } catch (error: unknown) {
        if (!controller.signal.aborted)
          setRead({
            key,
            kind: "error",
            order: null,
            error: errorMessage(error),
          });
      }
    };
    void load();
    return () => controller.abort();
  }, [id, owner, state.kind, skip, key, attempt]);
  return {
    ...(read?.key === key ? read : { kind: "loading" as const, order: null }),
    retry: () => setAttempt((value) => value + 1),
  };
}
