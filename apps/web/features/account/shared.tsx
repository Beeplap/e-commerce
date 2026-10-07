"use client";

import { useEffect, useRef, useState } from "react";
import { StorefrontBadge } from "@/components/storefront/content";
import { StorefrontButton } from "@/components/storefront/controls";
import { StorefrontNotice } from "@/components/storefront/feedback";
import { ApiError, errorMessage } from "@/lib/api/client";

export function AccountError({
  error,
  message,
  onRetry,
}: {
  error?: ApiError | null;
  message?: string;
  onRetry?: () => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    target.current?.focus();
  }, [error, message]);
  return (
    <div ref={target} tabIndex={-1} className="sf-account-error">
      <StorefrontNotice tone="error">
        <span>
          {message ?? error?.message ?? "We couldn't load this information."}
        </span>
        {error?.requestId && (
          <small>Request reference: {error.requestId}</small>
        )}
        {onRetry && (
          <StorefrontButton variant="secondary" onClick={onRetry}>
            Try again
          </StorefrontButton>
        )}
      </StorefrontNotice>
    </div>
  );
}
export function AccountLoading({ label }: { label: string }) {
  return (
    <div className="sf-account-loading" role="status">
      <p>{label}...</p>
      <div className="sf-skeleton" aria-hidden="true" />
      <div className="sf-skeleton" aria-hidden="true" />
    </div>
  );
}
export function AccountStatus({
  status,
  testId,
}: {
  status: string;
  testId?: string;
}) {
  const normalized = status.toLowerCase();
  return (
    <span data-testid={testId}>
      <StorefrontBadge
        tone={
          ["delivered", "paid", "verified"].includes(normalized)
            ? "success"
            : ["cancelled", "failed"].includes(normalized)
              ? "danger"
              : ["pending", "unverified"].includes(normalized)
                ? "warning"
                : "neutral"
        }
      >
        {status.replaceAll("_", " ")}
      </StorefrontBadge>
    </span>
  );
}
export function fieldError(error: ApiError | null, field: string) {
  return error?.fields[field]?.join(" ");
}
export function asAccountError(error: unknown) {
  return error instanceof ApiError
    ? error
    : new ApiError(errorMessage(error), 0);
}

/** Serialize commands; abort and discard late results on route/session unmount. Abort is not rollback. */
export function useAccountCommand() {
  const lifetime = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    lifetime.current = new AbortController();
    return () => {
      lifetime.current?.abort();
    };
  }, []);
  const active = () =>
    Boolean(lifetime.current && !lifetime.current.signal.aborted);
  return {
    busy,
    active,
    run: async (
      perform: (signal: AbortSignal) => Promise<void>,
      reject: (error: unknown) => void,
    ) => {
      if (inFlight.current || !active()) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await perform(lifetime.current!.signal);
      } catch (error) {
        if (active()) reject(error);
      } finally {
        inFlight.current = false;
        if (active()) setBusy(false);
      }
    },
  };
}
