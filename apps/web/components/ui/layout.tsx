import type { ReactNode } from "react";

export function PageActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      {children}
    </div>
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
