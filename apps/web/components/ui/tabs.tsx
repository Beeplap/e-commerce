"use client";

import { useId, useRef, type ReactNode } from "react";

export function Tabs<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: readonly { value: T; label: string; content: ReactNode }[];
}) {
  const identity = useId();
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  return (
    <div className="min-w-0">
      <div
        role="tablist"
        aria-label={label}
        className="mb-6 flex max-w-full gap-1 overflow-x-auto border-b border-ui-border p-1.5"
      >
        {items.map((item, index) => (
          <button
            key={item.value}
            ref={(element) => {
              if (element) buttons.current.set(item.value, element);
              else buttons.current.delete(item.value);
            }}
            type="button"
            role="tab"
            id={`${identity}-${item.value}-tab`}
            aria-controls={`${identity}-${item.value}-panel`}
            aria-selected={item.value === value}
            tabIndex={item.value === value ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        items.length) %
                      items.length;
              const target = items[next];
              if (target) {
                buttons.current.get(target.value)?.focus();
                onChange(target.value);
              }
            }}
            className={`min-h-11 shrink-0 border-b-2 px-3 py-2 text-ui-body font-semibold motion-safe:transition-colors duration-[var(--ui-duration-fast)] ${item.value === value ? "border-ui-accent text-ui-accent" : "border-transparent text-ui-secondary hover:text-ui-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.value}
          role="tabpanel"
          id={`${identity}-${item.value}-panel`}
          aria-labelledby={`${identity}-${item.value}-tab`}
          hidden={item.value !== value}
          tabIndex={0}
          className="min-w-0"
        >
          {item.value === value ? item.content : null}
        </div>
      ))}
    </div>
  );
}
