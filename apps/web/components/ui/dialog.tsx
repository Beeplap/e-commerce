"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

export function Dialog({
  open,
  title,
  description,
  children,
  busy = false,
  onClose,
  initialFocus,
  variant = "dialog",
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  variant?: "dialog" | "drawer";
}) {
  const identity = useId(),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus = document.activeElement;
    element.showModal();
    const oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    (initialFocus?.current ?? element).focus();
    return () => {
      element.close();
      document.documentElement.style.overflow = oldOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [open, initialFocus]);
  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-labelledby={`${identity}-title`}
      aria-describedby={description ? `${identity}-description` : undefined}
      aria-busy={busy || undefined}
      className={variant === "drawer" ? "ui-drawer" : "ui-dialog"}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClose={() => {
        if (open && !busy) onClose();
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
      {children}
    </dialog>
  );
}
