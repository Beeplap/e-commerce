"use client";

import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
import type { FieldErrors } from "@/lib/api/types";
import { controlStyle } from "./styles";

const FieldErrorsContext = createContext<FieldErrors>({});
export function FieldErrorsProvider({
  errors,
  children,
}: {
  errors: FieldErrors;
  children: ReactNode;
}) {
  return <FieldErrorsContext value={errors}>{children}</FieldErrorsContext>;
}
type FieldProps = { label: string; hint?: string; error?: string };
function useField({
  id,
  name,
  error,
  hint,
  describedBy,
}: {
  id?: string;
  name?: string;
  error?: string;
  hint?: string;
  describedBy?: string;
}) {
  const generated = useId(),
    errors = useContext(FieldErrorsContext);
  const fieldId = id ?? generated,
    message = error ?? (name ? errors[name]?.join(" ") : undefined);
  return {
    id: fieldId,
    error: message,
    describedBy:
      [
        describedBy,
        hint ? `${fieldId}-hint` : null,
        message ? `${fieldId}-error` : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}
function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & { id: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-2 block text-[13px] leading-5 font-medium text-ui-foreground"
      >
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-1 text-ui-danger">
              *
            </span>
          </>
        )}
      </label>
      {children}
      {hint && (
        <p
          id={`${id}-hint`}
          className="mt-1.5 text-ui-caption text-ui-secondary"
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-ui-caption text-ui-danger">
          {error}
        </p>
      )}
    </div>
  );
}
export function FormField({
  id,
  label,
  hint,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const field = useField({
    id,
    name: props.name,
    error,
    hint,
    describedBy: props["aria-describedby"],
  });
  return (
    <FieldShell {...field} label={label} hint={hint} required={props.required}>
      <input
        {...props}
        id={field.id}
        aria-invalid={Boolean(field.error)}
        aria-describedby={field.describedBy}
        className={`${controlStyle} ${field.error ? "border-ui-danger" : ""} ${className}`}
      />
    </FieldShell>
  );
}
export function TextareaField({
  id,
  label,
  hint,
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const field = useField({
    id,
    name: props.name,
    error,
    hint,
    describedBy: props["aria-describedby"],
  });
  return (
    <FieldShell {...field} label={label} hint={hint} required={props.required}>
      <textarea
        {...props}
        id={field.id}
        aria-invalid={Boolean(field.error)}
        aria-describedby={field.describedBy}
        className={`${controlStyle} min-h-28 resize-y ${field.error ? "border-ui-danger" : ""} ${className}`}
      />
    </FieldShell>
  );
}
export function SelectField({
  id,
  label,
  hint,
  error,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const field = useField({
    id,
    name: props.name,
    error,
    hint,
    describedBy: props["aria-describedby"],
  });
  return (
    <FieldShell {...field} label={label} hint={hint} required={props.required}>
      <select
        {...props}
        id={field.id}
        aria-invalid={Boolean(field.error)}
        aria-describedby={field.describedBy}
        className={`${controlStyle} ${field.error ? "border-ui-danger" : ""} ${className}`}
      >
        {children}
      </select>
    </FieldShell>
  );
}
