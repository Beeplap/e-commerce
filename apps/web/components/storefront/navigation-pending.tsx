"use client";

import { useLinkStatus } from "next/link";

/** Fixed-position visual cue stays inside Link context without shifting its label. */
export function StorefrontLinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      className="sf-link-pending"
      data-pending={pending}
      aria-hidden="true"
    />
  );
}
