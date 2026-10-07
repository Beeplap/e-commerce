"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

const activeDialogs = new Set<HTMLDialogElement>();
let originalOverflow = "";

export function Dialog({
  open,
  title,
  description,
  children,
  busy = false,
  onClose,
  initialFocus,
  variant = "dialog",
  size = "normal",
  error,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  variant?: "dialog" | "drawer";
  size?: "normal" | "wide";
  error?: string | null;
}) {
  const identity = useId(),
    dialog = useRef<HTMLDialogElement>(null);
  const errorSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus = document.activeElement;
    element.showModal();
    if (!activeDialogs.size)
      originalOverflow = document.documentElement.style.overflow;
    activeDialogs.add(element);
    document.documentElement.style.overflow = "hidden";
    const focusTarget =
      initialFocus?.current ??
      element.querySelector<HTMLElement>("[data-dialog-cancel]") ??
      element;
    (focusTarget.matches(":disabled") ? element : focusTarget).focus();
    return () => {
      element.close();
      activeDialogs.delete(element);
      if (!activeDialogs.size)
        document.documentElement.style.overflow = originalOverflow;
      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected &&
        (!activeDialogs.size ||
          [...activeDialogs].some((active) => active.contains(previousFocus)))
      )
        previousFocus.focus();
    };
  }, [open, initialFocus]);
  useEffect(() => {
    if (open && error) errorSummary.current?.focus();
  }, [open, error]);
  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-labelledby={`${identity}-title`}
      aria-describedby={description ? `${identity}-description` : undefined}
      aria-busy={busy || undefined}
      className={
        variant === "drawer"
          ? "ui-drawer"
          : `ui-dialog ${size === "wide" ? "ui-dialog-wide" : ""}`
      }
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClose={(event) => {
        if (open && !busy && !event.currentTarget.open) onClose();
      }}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <h2
        id={`${identity}-title`}
        className="text-ui-section font-semibold text-ui-foreground"
      >
        {title}
      </h2>
      {description && (
        <div
          id={`${identity}-description`}
          className="mt-3 text-ui-body text-ui-secondary"
        >
          {description}
        </div>
      )}
      {error && (
        <p
          ref={errorSummary}
          tabIndex={-1}
          role="alert"
          className="mt-4 rounded-control bg-ui-danger-surface p-3 text-ui-body text-ui-danger"
        >
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="mt-4 min-w-0 border-0 p-0">
        {children}
      </fieldset>
    </dialog>
  );
}
