"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, errorMessage } from "@/lib/api/client";
import { FormField } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ContentSection } from "@/components/ui/layout";
import { FieldErrorsProvider } from "@/components/ui/form-fields";
import { controlStyle } from "@/components/ui/styles";

export const panel = "rounded-panel border border-ui-border bg-ui-surface p-5";
export const selectStyle = controlStyle;
export function useMutation() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await action();
      setSuccess(true);
    } catch (caught) {
      setError(caught);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return { busy, error, success, run };
}
export function MutationStatus({
  error,
  success,
}: {
  error: unknown;
  success: boolean;
}) {
  return (
    <>
      {error != null && (
        <div
          role="alert"
          className="rounded-control bg-ui-danger-surface p-4 text-ui-body text-ui-danger"
        >
          <p>{errorMessage(error)}</p>
          {error instanceof ApiError &&
            Object.entries(error.fields).map(([field, messages]) => (
              <p key={field}>
                {field.replaceAll("_", " ")}: {messages.join(" ")}
              </p>
            ))}
        </div>
      )}
      {success && (
        <p role="status" className="text-ui-body text-ui-success">
          Saved successfully.
        </p>
      )}
    </>
  );
}
export function ManagedForm({
  title,
  submitLabel = "Save changes",
  onSave,
  children,
  disabled = false,
}: {
  title: string;
  submitLabel?: string;
  onSave: (data: FormData) => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}) {
  const mutation = useMutation();
  const identity = useId();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || mutation.busy) return;
    const data = new FormData(event.currentTarget);
    void mutation.run(() => onSave(data));
  }
  return (
    <form
      className={panel}
      onSubmit={submit}
      aria-labelledby={`${identity}-heading`}
      aria-busy={mutation.busy}
    >
      <ContentSection id={identity} title={title}>
        <FieldErrorsProvider
          errors={
            mutation.error instanceof ApiError ? mutation.error.fields : {}
          }
        >
          <fieldset disabled={disabled || mutation.busy} className="space-y-5">
            {children}
            {!disabled && (
              <Button busy={mutation.busy} type="submit">
                {mutation.busy ? "Saving…" : submitLabel}
              </Button>
            )}
          </fieldset>
        </FieldErrorsProvider>
        <div className="mt-4">
          <MutationStatus {...mutation} />
        </div>
      </ContentSection>
    </form>
  );
}
export function values(data: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(data.entries()).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
export function TextFields({
  fields,
  defaults = {},
}: {
  fields: readonly {
    name: string;
    label: string;
    required?: boolean;
    maxLength?: number;
    type?: string;
  }[];
  defaults?: Record<string, string>;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((field) => (
        <FormField
          key={field.name}
          {...field}
          defaultValue={defaults[field.name] ?? ""}
        />
      ))}
    </div>
  );
}
