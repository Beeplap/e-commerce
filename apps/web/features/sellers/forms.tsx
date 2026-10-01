"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, errorMessage } from "@/lib/api/client";
import { FormField, primaryButton } from "@/components/ui/primitives";

export const panel = "rounded-xl border border-slate-200 bg-white p-6";
export const selectStyle =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3";
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
          className="rounded-lg bg-red-50 p-4 text-sm text-red-900"
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
        <p role="status" className="text-sm text-teal-900">
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
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void mutation.run(() => onSave(data));
  }
  return (
    <form className={panel} onSubmit={submit}>
      <h2 className="mb-5 text-xl font-semibold">{title}</h2>
      <fieldset disabled={disabled || mutation.busy} className="space-y-5">
        {children}
        {!disabled && (
          <button className={primaryButton} type="submit">
            {mutation.busy ? "Saving…" : submitLabel}
          </button>
        )}
      </fieldset>
      <div className="mt-4">
        <MutationStatus {...mutation} />
      </div>
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
