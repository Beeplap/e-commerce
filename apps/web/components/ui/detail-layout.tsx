"use client";

import { useId, type ReactNode } from "react";

export function DetailSection({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const identity = useId();
  const heading = `${id ?? identity}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={heading}
      className="min-w-0 space-y-4 border-t border-ui-border pt-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id={heading}
            className="text-ui-section font-semibold text-ui-foreground"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-ui-caption text-ui-secondary">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function DetailGrid({
  items,
}: {
  items: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-ui-caption text-ui-secondary">{label}</dt>
          <dd className="mt-1 break-words text-ui-body text-ui-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SplitLayout({
  children,
  aside,
  asideLabel,
}: {
  children: ReactNode;
  aside: ReactNode;
  asideLabel: string;
}) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-3">
      <div className="min-w-0 space-y-6 xl:col-span-2">{children}</div>
      <aside aria-label={asideLabel} className="min-w-0 space-y-6">
        {aside}
      </aside>
    </div>
  );
}
