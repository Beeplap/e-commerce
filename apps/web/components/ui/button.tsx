"use client";

import type { ComponentPropsWithRef } from "react";
import {
  primaryButton,
  secondaryButton,
  dangerButton,
  quietButton,
} from "./styles";

export function Button({
  variant = "primary",
  busy = false,
  disabled,
  className = "",
  type = "button",
  children,
  ...props
}: ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "quiet";
  busy?: boolean;
}) {
  const styles = {
    primary: primaryButton,
    secondary: secondaryButton,
    danger: dangerButton,
    quiet: quietButton,
  };
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
