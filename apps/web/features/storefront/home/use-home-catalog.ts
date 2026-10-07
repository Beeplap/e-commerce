"use client";

import { useEffect, useState } from "react";
import { storefrontApi } from "@/lib/api/client";
import { homeCategories, homeProducts } from "./catalog";

export type Discovery<T> =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; value: T };

/** Independent public reads: partial failures remain visible and retries discard stale evidence. */
export function useHomeCatalog() {
  const [categories, setCategories] = useState<
    Discovery<ReturnType<typeof homeCategories>>
  >({ kind: "loading" });
  const [catalog, setCatalog] = useState<
    Discovery<ReturnType<typeof homeProducts>>
  >({ kind: "loading" });
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .categories(controller.signal)
      .then(homeCategories)
      .then((value) => {
        if (!controller.signal.aborted) setCategories({ kind: "ready", value });
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategories({ kind: "error" });
      });
    return () => controller.abort();
  }, [categoryAttempt]);
  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .products({ sort: "newest" }, controller.signal)
      .then(homeProducts)
      .then((value) => {
        if (!controller.signal.aborted) setCatalog({ kind: "ready", value });
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalog({ kind: "error" });
      });
    return () => controller.abort();
  }, [catalogAttempt]);
  return {
    categories,
    catalog,
    retryCategories: () => {
      setCategories({ kind: "loading" });
      setCategoryAttempt((value) => value + 1);
    },
    retryCatalog: () => {
      setCatalog({ kind: "loading" });
      setCatalogAttempt((value) => value + 1);
    },
  };
}
