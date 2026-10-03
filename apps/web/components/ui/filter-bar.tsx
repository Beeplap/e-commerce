"use client";

import type { ReactNode } from "react";
import { FormField } from "./form-fields";
import { Toolbar } from "./layout";
import { Button } from "./button";

export function FilterSummary({
  filters,
  onClear,
}: {
  filters: readonly string[];
  onClear: () => void;
}) {
  if (!filters.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-ui-caption text-ui-secondary">
      <span>Filtered by:</span>
      {filters.map((filter) => (
        <span key={filter} className="rounded-sm bg-ui-surface-muted px-2 py-1">
          {filter}
        </span>
      ))}
      <Button variant="quiet" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5">
      <Toolbar label="Filters">{children}</Toolbar>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  label = "Search",
  placeholder = "Search records",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0 basis-56 flex-1">
      <FormField
        label={label}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
