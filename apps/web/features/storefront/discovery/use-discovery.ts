"use client";

import { useEffect, useState } from "react";
import type {
  StorefrontCategory,
  StorefrontSearchResultPage,
} from "@/lib/api/types";
import { storefrontApi } from "@/lib/api/client";
import { categoryEvidence } from "../catalog-evidence";
import { discoveryEvidence } from "./evidence";
import { pageSize, type DiscoveryQuery } from "./query";

export type Read<T> =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; value: T };
export type Input =
  | { value: DiscoveryQuery; error?: undefined }
  | { error: string; value?: undefined };
export function useDiscovery(input: Input) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    input: Input;
    read: Read<StorefrontSearchResultPage>;
  }>({ input, read: { kind: "loading" } });
  useEffect(() => {
    if (!input.value) return;
    const controller = new AbortController();
    storefrontApi
      .search(
        {
          ...input.value.filters,
          q: input.value.query || undefined,
          page: input.value.page,
          limit: pageSize,
        },
        controller.signal,
      )
      .then(discoveryEvidence)
      .then((value) => {
        if (!controller.signal.aborted)
          setState({ input, read: { kind: "ready", value } });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ input, read: { kind: "error" } });
      });
    return () => controller.abort();
  }, [input, attempt]);
  return {
    read: state.input === input ? state.read : ({ kind: "loading" } as const),
    retry: () => {
      setState({ input, read: { kind: "loading" } });
      setAttempt((value) => value + 1);
    },
  };
}

export function useDiscoveryCategories() {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<Read<StorefrontCategory[]>>({
    kind: "loading",
  });
  useEffect(() => {
    const controller = new AbortController();
    storefrontApi
      .categories(controller.signal)
      .then((value) => {
        // Existing category API is unpaginated. Fail visibly beyond our metadata bound.
        if (!Array.isArray(value) || value.length > 1000)
          throw new Error("Invalid category evidence");
        return categoryEvidence(value, 1000);
      })
      .then((value) => {
        if (!controller.signal.aborted) setRead({ kind: "ready", value });
      })
      .catch(() => {
        if (!controller.signal.aborted) setRead({ kind: "error" });
      });
    return () => controller.abort();
  }, [attempt]);
  return {
    read,
    retry: () => {
      setRead({ kind: "loading" });
      setAttempt((value) => value + 1);
    },
  };
}
