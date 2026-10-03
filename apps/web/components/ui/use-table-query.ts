"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type Schema = Record<string, number | readonly string[]>;
const changeEvent = "ui:table-query-change";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(changeEvent, listener);
  };
}
function querySnapshot() {
  return window.location.search;
}
function serverSnapshot() {
  return "";
}
function pageNumber(value: string | null) {
  return value &&
    /^\d+$/.test(value) &&
    Number(value) >= 1 &&
    Number(value) <= 10000
    ? Number(value)
    : 1;
}
function fieldValue(value: string, rule: number | readonly string[]) {
  return typeof rule === "number"
    ? value.slice(0, rule)
    : value === "" || rule.includes(value)
      ? value
      : "";
}

// URL state is a view preference only. It never selects a seller or grants access.
export function useTableQuery<T extends Schema>(
  schema: T,
  defaults: Partial<Record<keyof T, string>> = {},
) {
  const search = useSyncExternalStore(subscribe, querySnapshot, serverSnapshot);
  const schemaKey = JSON.stringify(schema),
    defaultKey = JSON.stringify(defaults);
  const values = useMemo(() => {
    const rules = JSON.parse(schemaKey) as Schema,
      initial = JSON.parse(defaultKey) as Record<string, string>;
    const params = new URLSearchParams(search);
    return Object.fromEntries(
      Object.entries(rules).map(([key, rule]) => [
        key,
        fieldValue(params.get(key) ?? initial[key] ?? "", rule),
      ]),
    ) as Record<keyof T, string>;
  }, [search, schemaKey, defaultKey]);
  const page = pageNumber(new URLSearchParams(search).get("page"));
  function update(patch: Partial<Record<string, string>>, replace = false) {
    const url = new URL(window.location.href);
    const rules = JSON.parse(schemaKey) as Schema,
      initial = JSON.parse(defaultKey) as Record<string, string>;
    for (const [key, raw] of Object.entries(patch)) {
      if (raw === undefined) continue;
      if (key === "page") {
        const next = pageNumber(raw);
        if (next === 1) url.searchParams.delete(key);
        else url.searchParams.set(key, String(next));
      } else if (Object.hasOwn(rules, key)) {
        const next = fieldValue(raw, rules[key]!);
        if (next === "" && !initial[key]) url.searchParams.delete(key);
        else url.searchParams.set(key, next);
      }
    }
    const destination = `${url.pathname}${url.search}${url.hash}`;
    if (
      destination ===
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      return;
    window.history[replace ? "replaceState" : "pushState"](
      window.history.state,
      "",
      destination,
    );
    window.dispatchEvent(new Event(changeEvent));
  }
  return {
    values,
    page,
    setFilters: (patch: Partial<Record<keyof T, string>>, replace = false) =>
      update({ ...patch, page: "1" }, replace),
    setPage: (next: number) => update({ page: String(next) }),
    clear: () =>
      update(
        Object.fromEntries(
          Object.keys(schema)
            .map((key) => [key, ""])
            .concat([["page", "1"]]),
        ) as Partial<Record<keyof T | "page", string>>,
      ),
  };
}

export function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
