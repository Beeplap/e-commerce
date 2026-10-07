"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/auth-provider";
import type { OrderEvidence } from "./evidence";

type Session = {
  placed: OrderEvidence | null;
  captured: OrderEvidence | null;
  rememberPlacement: (order: OrderEvidence) => void;
  rememberCapture: (order: OrderEvidence) => void;
};
const Context = createContext<Session | null>(null);

/** Presentation snapshots only. Guest authorization stays in Django's session. */
export function CheckoutSessionProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const identity = state.kind === "authenticated" ? state.user.id : state.kind;
  const [record, setRecord] = useState<{
    identity: string;
    placed: OrderEvidence | null;
    captured: OrderEvidence | null;
  }>({ identity, placed: null, captured: null });
  if (record.identity !== identity)
    setRecord({ identity, placed: null, captured: null });
  const rememberPlacement = useCallback(
    (placed: OrderEvidence) => setRecord({ identity, placed, captured: null }),
    [identity],
  );
  const rememberCapture = useCallback(
    (captured: OrderEvidence) =>
      setRecord((previous) => ({
        identity,
        placed: previous.identity === identity ? previous.placed : null,
        captured,
      })),
    [identity],
  );
  const visible =
    record.identity === identity ? record : { placed: null, captured: null };
  return (
    <Context
      value={{
        placed: visible.placed,
        captured: visible.captured,
        rememberPlacement,
        rememberCapture,
      }}
    >
      {children}
    </Context>
  );
}
export function useCheckoutSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Checkout requires CheckoutSessionProvider.");
  return value;
}
