"use client";

import { useEffect, useState } from "react";
import { storefrontApi } from "@/lib/api/client";

export type NavigationItem = { id: string; name: string; href: string };
type NavigationState =
  | { kind: "loading" }
  | { kind: "ready"; items: NavigationItem[] }
  | { kind: "error" };

function namedItem(
  value: unknown,
  type: "category" | "seller",
): NavigationItem {
  if (!value || typeof value !== "object")
    throw new Error("Invalid navigation response");
  const item = value as Record<string, unknown>;
  const name = type === "seller" ? item.store_name || item.name : item.name;
  if (
    typeof item.id !== "string" ||
    !item.id ||
    typeof name !== "string" ||
    !name.trim()
  )
    throw new Error("Invalid navigation identity");
  return {
    id: item.id,
    name,
    href: `/${type === "seller" ? "sellers" : "categories"}/${encodeURIComponent(item.id)}`,
  };
}

/** Public, bounded catalog discovery is not a seller directory or an authorization grant. */
export function useNavigationData(sellersEnabled: boolean) {
  const [categories, setCategories] = useState<NavigationState>({
    kind: "loading",
  });
  const [sellers, setSellers] = useState<NavigationState>({ kind: "loading" });
  const [categoryAttempt, retryCategories] = useState(0);
  const [sellerAttempt, retrySellers] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .categories(controller.signal)
      .then((response) => {
        if (!Array.isArray(response))
          throw new Error("Invalid category response");
        const items = response
          .slice(0, 24)
          .map((value) => namedItem(value, "category"));
        if (!controller.signal.aborted) setCategories({ kind: "ready", items });
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategories({ kind: "error" });
      });
    return () => controller.abort();
  }, [categoryAttempt]);
  useEffect(() => {
    if (!sellersEnabled) return;
    const controller = new AbortController();
    storefrontApi
      .products({ sort: "newest" }, controller.signal)
      .then((response) => {
        if (!Array.isArray(response.results))
          throw new Error("Invalid catalog response");
        const unique = new Map<string, NavigationItem>();
        for (const product of response.results.slice(0, 25)) {
          const item = namedItem(product.seller, "seller");
          unique.set(item.id, item);
        }
        if (!controller.signal.aborted)
          setSellers({
            kind: "ready",
            items: [...unique.values()].slice(0, 8),
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSellers({ kind: "error" });
      });
    return () => controller.abort();
  }, [sellersEnabled, sellerAttempt]);
  return {
    categories,
    sellers,
    retryCategories: () => {
      setCategories({ kind: "loading" });
      retryCategories((value) => value + 1);
    },
    retrySellers: () => {
      setSellers({ kind: "loading" });
      retrySellers((value) => value + 1);
    },
  };
}
