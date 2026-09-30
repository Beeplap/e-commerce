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
      className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className="px-5 py-3 text-xs font-semibold"
              >
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.id} className="px-5 py-4">
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
