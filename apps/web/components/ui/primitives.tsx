"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import type { ApiError } from "@/lib/api/client";

import { secondaryButton } from "./styles";
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
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        )}
      </div>
      {actions}
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
    <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
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
      className={`motion-safe:animate-pulse rounded bg-slate-200 ${className}`}
    />
  );
}

export function LoadingState({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div
      className="mx-auto max-w-3xl px-6 py-12"
      role="status"
      aria-live="polite"
    >
      <p className="mb-6 text-sm text-slate-600">{label}</p>
      <Skeleton className="mb-4 h-9 w-2/3" />
      <Skeleton className="h-32 w-full" />
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
    <section
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-6"
    >
      <h2 className="font-semibold text-red-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-red-900">{message}</p>
      {requestId && (
        <p className="mt-2 text-xs text-red-900">
          Request reference: {requestId}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`${secondaryButton} mt-4`}
        >
          Try again
        </button>
      )}
    </section>
  );
}

export function FormField({
  id,
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptions = [
    hint ? `${inputId}-hint` : null,
    error ? `${inputId}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-medium text-slate-800"
      >
        {label}
        {props.required && <span className="sr-only"> (required)</span>}
      </label>
      <input
        {...props}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptions || undefined}
        className={`min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-slate-950 disabled:bg-slate-100 ${error ? "border-red-500" : "border-slate-300"} ${props.className ?? ""}`}
      />
      {hint && (
        <p id={`${inputId}-hint`} className="mt-2 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = ["active", "verified"].includes(status)
    ? "bg-teal-50 text-teal-900 ring-teal-200"
    : ["suspended", "rejected", "closed"].includes(status)
      ? "bg-red-50 text-red-900 ring-red-200"
      : "bg-amber-50 text-amber-950 ring-amber-200";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${tone}`}
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
