"use client";

import type { ReactNode } from "react";
import type { ApiError } from "@/lib/api/client";

import { Button } from "./button";
import { PageActions } from "./layout";
import { statusStyles, statusTone } from "./status";
export { FormField, TextareaField, SelectField } from "./form-fields";
export { primaryButton, secondaryButton } from "./styles";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl leading-8 font-semibold tracking-tight break-words text-ui-foreground sm:text-ui-page">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-ui-body text-ui-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && <PageActions>{actions}</PageActions>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="px-4 py-8 text-center">
      <h2 className="text-ui-section font-semibold text-ui-foreground">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-ui-body text-ui-secondary">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

export function Skeleton({ className = "h-5 w-full" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`motion-safe:animate-pulse rounded-control bg-ui-border ${className}`}
    />
  );
}

export function LoadingState({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="min-w-0 space-y-4 py-6" role="status" aria-live="polite">
      <p className="text-ui-body text-ui-secondary">{label}</p>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function ErrorState({
  title = "We couldn’t load this page",
  message,
  requestId,
  onRetry,
}: {
  title?: string;
  message: string;
  requestId?: string | null;
  onRetry?: () => void;
}) {
  return (
    <section role="alert" className="rounded-panel bg-ui-danger-surface p-5">
      <h2 className="font-semibold text-ui-danger">{title}</h2>
      <p className="mt-2 text-ui-body text-ui-danger">{message}</p>
      {requestId && (
        <p className="mt-2 break-words text-ui-caption text-ui-danger">
          Request reference: {requestId}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span
      data-tone={tone}
      className={`inline-flex max-w-full items-center rounded px-2 py-1 text-ui-caption font-medium capitalize ${statusStyles[tone]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function ApiErrorState({
  error,
  onRetry,
}: {
  error: ApiError;
  onRetry?: () => void;
}) {
  return (
    <ErrorState
      message={error.message}
      requestId={error.requestId}
      onRetry={onRetry}
    />
  );
}
