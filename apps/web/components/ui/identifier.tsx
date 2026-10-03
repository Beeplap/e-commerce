"use client";

import { useState } from "react";
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
  const [feedback, setFeedback] = useState<string | null>(null);
  async function copy() {
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setFeedback(`${label} copied`);
    } catch {
      setFeedback("Copy is unavailable. Select the identifier to copy it.");
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
          title={`Copy ${label}`}
          onClick={() => void copy()}
        >
          <Icon name="copy" size={16} />
        </Button>
      )}
      {feedback && (
        <span
          role="status"
          className="w-full text-ui-caption text-ui-secondary"
        >
          {feedback}
        </span>
      )}
    </span>
  );
}
