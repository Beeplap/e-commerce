"use client";

import { secondaryButton } from "./primitives";

export function Pagination({
  page,
  count,
  pageSize = 25,
  busy = false,
  onPageChange,
}: {
  page: number;
  count: number;
  pageSize?: number;
  busy?: boolean;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <nav
      aria-label="Pagination"
      className="mt-5 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-slate-600" aria-live="polite">
        Page {page} of {pages} · {count} {count === 1 ? "record" : "records"}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={busy || page >= pages || page >= 10000}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
