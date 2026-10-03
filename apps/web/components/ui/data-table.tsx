import type { ReactNode } from "react";
import { EmptyState, LoadingState } from "./primitives";

export interface Column<T> {
  id: string;
  heading: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  loading = false,
  mobile = "stacked",
  filtered = false,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  mobile?: "stacked" | "scroll";
  filtered?: boolean;
}) {
  if (loading)
    return (
      <LoadingState
        variant="table"
        label={`Loading ${caption.toLowerCase()}…`}
      />
    );
  if (rows.length === 0)
    return (
      <EmptyState
        title={filtered ? "No matching results" : "No results"}
        description={
          filtered
            ? "Adjust or clear your filters to see more records."
            : "There are no records to display for this view."
        }
      />
    );
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-panel border border-ui-border bg-ui-surface"
      data-mobile={mobile}
    >
      <table
        role="table"
        className={`ui-data-table w-full border-collapse text-left text-ui-body text-ui-foreground ${mobile === "stacked" ? "ui-data-table-stacked" : "min-w-[640px]"}`}
      >
        <caption className="sr-only">{caption}</caption>
        <thead
          role="rowgroup"
          className="border-b border-ui-border bg-ui-surface-muted text-ui-secondary"
        >
          <tr role="row">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                role="columnheader"
                data-align={column.align}
                className={`px-4 py-2.5 text-ui-caption font-semibold ${column.align === "right" ? "text-right" : "text-left"}`}
              >
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="divide-y divide-ui-border">
          {rows.map((row) => (
            <tr
              role="row"
              key={rowKey(row)}
              className="hover:bg-ui-surface-muted"
            >
              {columns.map((column) => (
                <td
                  role="cell"
                  key={column.id}
                  data-align={column.align}
                  className={`px-4 py-3 align-top ${column.align === "right" ? "text-right tabular-nums" : "text-left"}`}
                >
                  {mobile === "stacked" && (
                    <span
                      aria-hidden="true"
                      className="ui-data-label hidden text-ui-caption font-medium text-ui-secondary"
                    >
                      {column.heading}
                    </span>
                  )}
                  <div className="ui-data-value min-w-0 break-words">
                    {column.cell(row)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
