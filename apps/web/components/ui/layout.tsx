import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="workspace-content"
      tabIndex={-1}
      className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8"
    >
      {children}
    </main>
  );
}

export function PageActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      {children}
    </div>
  );
}

export function StatGroup({
  items,
}: {
  items: readonly {
    label: string;
    value: ReactNode;
    hint?: string;
    primary?: boolean;
  }[];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-ui-caption font-medium text-ui-secondary">
            {item.label}
          </dt>
          <dd
            className={`mt-1 break-words font-semibold tracking-tight tabular-nums ${item.primary ? "text-[28px] leading-[34px]" : "text-xl leading-7"}`}
          >
            {item.value}
          </dd>
          {item.hint && (
            <p className="mt-1 text-ui-caption text-ui-muted">{item.hint}</p>
          )}
        </div>
      ))}
    </dl>
  );
}
export function ContentSection({
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
  id: string;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${id}-heading`}
            className="text-ui-section font-semibold text-ui-foreground"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-ui-body text-ui-secondary">{description}</p>
          )}
        </div>
        {actions && <PageActions>{actions}</PageActions>}
      </div>
      {children}
    </section>
  );
}
export function Toolbar({
  label = "Actions and filters",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex min-w-0 flex-wrap items-end gap-3"
    >
      {children}
    </div>
  );
}
