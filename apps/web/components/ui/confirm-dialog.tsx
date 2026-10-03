"use client";

import { useRef } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

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
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      busy={busy}
      onClose={onCancel}
      initialFocus={cancel}
    >
      {error && (
        <p role="alert" className="mt-3 text-ui-body text-ui-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          ref={cancel}
          variant="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button busy={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
