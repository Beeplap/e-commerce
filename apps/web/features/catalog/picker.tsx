"use client";

import { useCallback, useId, useState } from "react";
import {
  ApiErrorState,
  FormField,
  LoadingState,
} from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { selectStyle } from "@/features/sellers/forms";
import { useApiQuery } from "@/lib/api/use-api-query";
import { catalogApi, type Context, type Kind, type CatalogRecord } from "./api";

export function CatalogPicker({
  context,
  kind,
  label,
  name,
  required = false,
  initial,
  filterId,
  onSelect,
}: {
  context: Context;
  kind: Kind;
  label: string;
  name: string;
  required?: boolean;
  initial?: { id: string; name: string } | null;
  filterId?: string;
  onSelect?: (record: CatalogRecord | null) => void;
}) {
  const controlId = useId();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(initial ?? null);
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.taxonomy(
        sellerId ? { sellerId } : { platform: true },
        kind,
        {
          page,
          ...(kind !== "category-attributes" ? { search } : {}),
          ...(filterId
            ? {
                [kind === "options" ? "attribute_id" : "category_id"]: filterId,
              }
            : {}),
        },
        signal,
      ),
    [sellerId, kind, page, search, filterId],
  );
  const result = useApiQuery(
    `${sellerId ?? "platform"}:${kind}:${page}:${search}:${filterId ?? ""}`,
    load,
  );
  return (
    <div className="space-y-3">
      {kind !== "category-attributes" && (
        <FormField
          label={`Search ${label.toLowerCase()}`}
          value={search}
          maxLength={100}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      )}
      <label htmlFor={controlId} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={controlId}
        name={name}
        required={required}
        className={selectStyle}
        value={selected?.id ?? ""}
        onChange={(event) => {
          const row =
            result.kind === "ready"
              ? (result.data.results.find(
                  (row) => row.id === event.target.value,
                ) ?? null)
              : null;
          setSelected(row);
          onSelect?.(row);
        }}
      >
        <option value="">{required ? "Choose an option" : "None"}</option>
        {selected &&
          (result.kind !== "ready" ||
            !result.data.results.some((row) => row.id === selected.id)) && (
            <option value={selected.id}>{selected.name}</option>
          )}
        {result.kind === "ready" &&
          result.data.results.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
      </select>
      {result.kind === "loading" && <LoadingState label="Loading options…" />}
      {result.kind === "error" && (
        <ApiErrorState error={result.error} onRetry={result.retry} />
      )}
      {result.kind === "ready" && result.data.count > 25 && (
        <Pagination
          page={page}
          count={result.data.count}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
