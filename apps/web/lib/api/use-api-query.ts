"use client";

import { useEffect, useState } from "react";
import { ApiError, isAbort } from "./client";

type QueryState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "error"; error: ApiError };

export function useApiQuery<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [version, setVersion] = useState(0);
  const requestKey = key === null ? null : `${key}:${version}`;
  const [result, setResult] = useState<{
    key: string;
    state: QueryState<T>;
  } | null>(null);
  useEffect(() => {
    if (requestKey === null) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => load(controller.signal))
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, state: { kind: "ready", data } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setResult({
          key: requestKey,
          state: {
            kind: "error",
            error:
              error instanceof ApiError
                ? error
                : new ApiError("We couldn’t load this information.", 0),
          },
        });
      });
    return () => controller.abort();
  }, [requestKey, load]);
  const state: QueryState<T> =
    requestKey !== null && result?.key === requestKey
      ? result.state
      : { kind: "loading" };
  return { ...state, retry: () => setVersion((current) => current + 1) };
}
