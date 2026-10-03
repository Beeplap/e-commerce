"use client";

import { useRef, useState } from "react";
import { Button } from "./button";
import { Icon } from "./icon";

export function Identifier({
  value,
  label = "ID",
  copyable = false,
  prefix = "",
}: {
  value: string;
  label?: string;
  copyable?: boolean;
  prefix?: string;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    value: string;
    label: string;
    copied: boolean;
    message: string;
  } | null>(null);
  const currentFeedback =
    feedback?.value === value && feedback.label === label ? feedback : null;
  async function copy() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setFeedback({ value, label, copied: true, message: `${label} copied` });
    } catch {
      setFeedback({
        value,
        label,
        copied: false,
        message: "Copy is unavailable. Select the identifier to copy it.",
      });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <code
        title={value}
        className="break-all text-ui-caption text-ui-secondary"
      >
        {prefix}
        {value}
      </code>
      {copyable && (
        <Button
          variant="quiet"
          className="size-11 px-2"
          aria-label={`Copy ${label}`}
          title={currentFeedback?.copied ? `${label} copied` : `Copy ${label}`}
          busy={busy}
          onClick={() => void copy()}
        >
          <Icon name={currentFeedback?.copied ? "check" : "copy"} size={16} />
        </Button>
      )}
      {currentFeedback && (
        <span
          role="status"
          className={
            currentFeedback.copied
              ? "sr-only"
              : "w-full text-ui-caption text-ui-secondary"
          }
        >
          {currentFeedback.message}
        </span>
      )}
    </span>
  );
}
