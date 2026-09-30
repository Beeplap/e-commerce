"use client";

import { useEffect, useId, useRef } from "react";
import { primaryButton, secondaryButton } from "./primitives";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus = document.activeElement;
    element.showModal();
    cancel.current?.focus();
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      className="w-[calc(100%_-_2rem)] max-w-md rounded-xl border-0 bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-950/45"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h2>
      <p
        id={`${id}-description`}
        className="mt-3 text-sm leading-6 text-slate-600"
      >
        {description}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button
          ref={cancel}
          type="button"
          disabled={busy}
          className={secondaryButton}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          className={primaryButton}
          onClick={onConfirm}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
