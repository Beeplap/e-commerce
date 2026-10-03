"use client";

import type { ReactNode } from "react";
import { FormField } from "./form-fields";
import { Toolbar } from "./layout";

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
