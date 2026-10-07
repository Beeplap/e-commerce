import type { ReactNode } from "react";
import { DateDisplay } from "./displays";

export interface TimelineEntry {
  id: string;
  title: ReactNode;
  occurredAt: string | null;
  description?: ReactNode;
  actor?: ReactNode;
}

export function Timeline({
  entries,
  label,
  emptyMessage = "No events recorded.",
  timezone = "UTC",
}: {
  entries: readonly TimelineEntry[];
  label: string;
  emptyMessage?: string;
  timezone?: string;
}) {
  if (!entries.length)
    return <p className="text-ui-body text-ui-secondary">{emptyMessage}</p>;
  return (
    <ol aria-label={label} className="ml-1 border-l border-ui-border">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="relative min-w-0 pb-5 pl-5 last:pb-0 before:absolute before:-left-[4px] before:top-2 before:h-[7px] before:w-[7px] before:rounded-full before:bg-ui-control-border"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="break-words text-ui-body font-medium text-ui-foreground">
              {entry.title}
            </p>
            {entry.occurredAt && (
              <span className="shrink-0 text-ui-caption text-ui-secondary">
                <DateDisplay value={entry.occurredAt} timezone={timezone} />
              </span>
            )}
          </div>
          {entry.description && (
            <div className="mt-1 break-words text-ui-body text-ui-secondary">
              {entry.description}
            </div>
          )}
          {entry.actor && (
            <div className="mt-2 break-words text-ui-caption text-ui-secondary">
              {entry.actor}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
