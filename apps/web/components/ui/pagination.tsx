"use client";

import { Button } from "./button";

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
      <p className="text-ui-caption text-ui-secondary" aria-live="polite">
        Page {page} of {pages} · {count} {count === 1 ? "record" : "records"}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={busy || page >= pages || page >= 10000}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
