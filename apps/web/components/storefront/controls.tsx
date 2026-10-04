"use client";

import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

export function StorefrontButton({
  variant = "primary",
  busy = false,
  disabled,
  type = "button",
  className = "",
  ...props
}: ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      data-variant={variant}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`sf-button ${className}`}
    />
  );
}

type FieldDetails = { label: ReactNode; hint?: string; error?: string };
export function StorefrontInput({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: ComponentPropsWithRef<"input"> & FieldDetails) {
  const identity = useId();
  const controlId = id ?? identity;
  const describedBy =
    [
      props["aria-describedby"],
      hint ? `${controlId}-hint` : null,
      error ? `${controlId}-error` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="sf-field">
      <label className="sf-field-label" htmlFor={controlId}>
        {label}
      </label>
      <input
        {...props}
        id={controlId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={`sf-control ${className}`}
      />
      {hint && (
        <p id={`${controlId}-hint`} className="sf-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${controlId}-error`} className="sf-field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function StorefrontSelect({
  label,
  hint,
  error,
  id,
  className = "",
  children,
  ...props
}: ComponentPropsWithRef<"select"> & FieldDetails) {
  const identity = useId();
  const controlId = id ?? identity;
  const describedBy =
    [
      props["aria-describedby"],
      hint ? `${controlId}-hint` : null,
      error ? `${controlId}-error` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="sf-field">
      <label className="sf-field-label" htmlFor={controlId}>
        {label}
      </label>
      <select
        {...props}
        id={controlId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={`sf-control ${className}`}
      >
        {children}
      </select>
      {hint && (
        <p id={`${controlId}-hint`} className="sf-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${controlId}-error`} className="sf-field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Display bounds are hints. Every cart mutation must still be accepted by Django. */
export function StorefrontQuantity({
  value,
  maximum,
  minimum = 1,
  disabled = false,
  onChange,
}: {
  value: number;
  maximum: number;
  minimum?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  if (![value, maximum, minimum].every(Number.isSafeInteger) || minimum < 1)
    throw new Error(
      "Quantity bounds must be safe integers with a positive minimum.",
    );
  const unavailable = disabled || maximum < minimum;
  return (
    <div className="sf-quantity" role="group" aria-label="Quantity">
      <StorefrontButton
        variant="quiet"
        aria-label="Decrease quantity"
        disabled={unavailable || value <= minimum}
        onClick={() =>
          onChange(Math.max(minimum, Math.min(maximum, value - 1)))
        }
      >
        −
      </StorefrontButton>
      <output data-testid="selected-quantity" aria-live="polite">
        {value}
      </output>
      <StorefrontButton
        variant="quiet"
        aria-label="Increase quantity"
        disabled={unavailable || value >= maximum}
        onClick={() => onChange(Math.min(maximum, value + 1))}
      >
        +
      </StorefrontButton>
    </div>
  );
}
