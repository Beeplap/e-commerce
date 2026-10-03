"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useUnsavedChanges } from "@/components/ui/unsaved-changes";
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
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await action();
      setSuccess(true);
      return true;
    } catch (caught) {
      setError(caught ?? new Error("Request failed"));
      return false;
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
  summaryRef,
}: {
  error: unknown;
  success: boolean;
  summaryRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      {error != null && (
        <div
          ref={summaryRef}
          tabIndex={-1}
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
        <p role="status" className="ui-feedback text-ui-body text-ui-success">
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
  warnUnsaved = false,
  stickyActions = false,
}: {
  title: string;
  submitLabel?: string;
  onSave: (data: FormData) => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
  warnUnsaved?: boolean;
  stickyActions?: boolean;
}) {
  const mutation = useMutation();
  const form = useRef<HTMLFormElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const baseline = useRef<string | null>(null);
  const focused = useRef(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(title, warnUnsaved && dirty && !disabled);
  function snapshot(element: HTMLFormElement | FormData) {
    return JSON.stringify(
      [
        ...(element instanceof FormData
          ? element
          : new FormData(element)
        ).entries(),
      ].map(([name, value]) => [
        name,
        typeof value === "string"
          ? value
          : `${value.name}:${value.size}:${value.lastModified}`,
      ]),
    );
  }
  useEffect(() => {
    if (form.current) baseline.current = snapshot(form.current);
  }, []);
  useEffect(() => {
    if (mutation.error !== null)
      (
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        errorSummary.current
      )?.focus();
  }, [mutation.error]);
  const identity = useId();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || mutation.busy) return;
    const element = event.currentTarget;
    const data = new FormData(element);
    const submitted = snapshot(data);
    void mutation
      .run(() => onSave(data))
      .then((saved) => {
        if (saved) {
          baseline.current = submitted;
          setDirty(false);
        }
      });
  }
  return (
    <form
      ref={form}
      className={`${panel} max-w-(--ui-form-width)`}
      onFocusCapture={() => {
        if (!focused.current && form.current && !dirty) {
          baseline.current = snapshot(form.current);
          focused.current = true;
        }
      }}
      onChange={() => {
        if (form.current) setDirty(snapshot(form.current) !== baseline.current);
      }}
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
              <div
                className={`flex flex-wrap items-center gap-3 ${stickyActions ? "sticky bottom-0 z-10 border-t border-ui-border bg-ui-surface py-3" : ""}`}
              >
                <Button busy={mutation.busy} type="submit">
                  {mutation.busy ? "Saving…" : submitLabel}
                </Button>
                {dirty && (
                  <span className="text-ui-caption text-ui-secondary">
                    Unsaved changes
                  </span>
                )}
              </div>
            )}
          </fieldset>
        </FieldErrorsProvider>
        <div className="mt-4">
          <MutationStatus
            summaryRef={errorSummary}
            error={mutation.error}
            success={mutation.success && !dirty}
          />
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
