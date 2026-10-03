import type { ReactNode } from "react";
import { EmptyState, LoadingState } from "./primitives";

export interface Column<T> {
  id: string;
  heading: string;
  cell: (row: T) => ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  loading = false,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
}) {
  if (loading)
    return <LoadingState label={`Loading ${caption.toLowerCase()}…`} />;
  if (rows.length === 0)
    return (
      <EmptyState
        title="No results"
        description="There are no records to display for this view."
      />
    );
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-panel border border-ui-border bg-ui-surface"
    >
      <table className="w-full border-collapse text-left text-ui-body text-ui-foreground">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-ui-border bg-ui-surface-muted text-ui-secondary">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className="px-4 py-2.5 text-ui-caption font-semibold"
              >
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-border">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-ui-surface-muted">
              {columns.map((column) => (
                <td key={column.id} className="px-4 py-3">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
