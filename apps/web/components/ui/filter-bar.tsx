"use client";

import { useId, type ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label="Filters"
      className="mb-5 flex flex-wrap items-end gap-3"
    >
      {children}
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
  const id = useId();
  return (
    <div className="min-w-48 flex-1">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}
