"use client";

import {
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Dialog } from "@/components/ui/dialog";
import { StorefrontButton } from "./controls";

/** Reuses native top-layer focus/inertness, scroll locking, busy dismissal and focus restoration. */
export function StorefrontOverlay({
  kind = "modal",
  children,
  ...props
}: Omit<ComponentProps<typeof Dialog>, "variant"> & {
  kind?: "modal" | "drawer";
}) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (props.open && props.busy)
      host.current?.querySelector<HTMLDialogElement>("dialog[open]")?.focus();
  }, [props.open, props.busy]);
  return (
    <div
      ref={host}
      className="sf-storefront sf-overlay"
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const dialog =
          event.target instanceof Element
            ? event.target.closest("dialog")
            : null;
        if (!dialog?.open) return;
        const controls = [
          ...dialog.querySelectorAll<HTMLElement>(
            "button, a[href], input, select, textarea, [tabindex]",
          ),
        ].filter(
          (element) =>
            !element.matches(":disabled") &&
            element.tabIndex >= 0 &&
            element.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <Dialog {...props} variant={kind === "drawer" ? "drawer" : "dialog"}>
        <div className="sf-overlay-close">
          <StorefrontButton
            variant="quiet"
            data-dialog-cancel
            disabled={props.busy}
            onClick={props.onClose}
          >
            Close
          </StorefrontButton>
        </div>
        {children}
      </Dialog>
    </div>
  );
}

/** Caller-owned messages represent accepted results; this component never invents success. */
export function StorefrontNotice({
  children,
  tone = "info",
  onDismiss,
}: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
  onDismiss?: () => void;
}) {
  return (
    <div
      className="sf-notice"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      <span>{children}</span>
      {onDismiss && (
        <StorefrontButton
          variant="quiet"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          Dismiss
        </StorefrontButton>
      )}
    </div>
  );
}
