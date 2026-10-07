"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";

export function useCartActions(identity: string, visible = true) {
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const inFlight = useRef(false),
    alive = useRef(false);
  const triggerRef = useRef<HTMLElement | undefined>(undefined);
  const generation = useRef(0);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const bindFeedback = useCallback((element: HTMLParagraphElement | null) => {
    feedbackRef.current = element;
  }, []);
  const invalidate = useCallback(() => {
    ++generation.current;
    alive.current = false;
  }, []);
  useEffect(() => {
    ++generation.current;
    alive.current = true;
    return () => {
      invalidate();
    };
  }, [identity, invalidate]);
  useEffect(() => {
    if (
      visible &&
      (feedback?.kind === "error" ||
        (feedback?.kind === "success" &&
          triggerRef.current &&
          !triggerRef.current.isConnected))
    )
      feedbackRef.current?.focus();
  }, [feedback, visible]);
  const run = async (
    id: string,
    operation: () => Promise<void>,
    message: string,
    trigger?: HTMLElement,
  ) => {
    if (inFlight.current) return;
    const current = generation.current;
    triggerRef.current = trigger;
    inFlight.current = true;
    setPending(id);
    setFeedback(null);
    try {
      await operation();
      if (alive.current && current === generation.current) {
        setFeedback(message ? { kind: "success", message } : null);
      }
    } catch (error: unknown) {
      if (alive.current && current === generation.current)
        setFeedback({ kind: "error", message: errorMessage(error) });
    } finally {
      inFlight.current = false;
      if (alive.current && current === generation.current) setPending(null);
    }
  };
  return { feedback, pending, bindFeedback, run };
}
export type CartActions = ReturnType<typeof useCartActions>;
