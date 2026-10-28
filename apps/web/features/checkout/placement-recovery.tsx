"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StorefrontButton } from "@/components/storefront/controls";
import { checkoutApi, errorMessage } from "@/lib/api/client";
import { isUuid } from "@/lib/api/validation";
import type { PlacementRecovery } from "@/lib/api/types";
import { useCart } from "../cart/cart-context";

type Reference = { cartId: string; key: string };
const prefix = "#checkout_attempt=";

export function placementReference(hash: string): Reference | null | "invalid" {
  if (!hash.startsWith(prefix)) return null;
  const [cartId, key, extra] = hash.slice(prefix.length).split(".");
  if (
    !isUuid(cartId) ||
    !key ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(key) ||
    extra !== undefined
  )
    return "invalid";
  return { cartId, key };
}

/** Non-authorizing identifiers only. A fragment is not sent in HTTP/Referer requests. */
export function retainPlacementReference(cartId: string, key: string) {
  const hash = `${prefix}${cartId}.${key}`;
  if (!placementReference(hash) || placementReference(hash) === "invalid")
    throw new Error("Invalid checkout reference");
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}${hash}`,
  );
  if (window.location.hash !== hash)
    throw new Error("Checkout reference was not retained");
}

export function clearPlacementReference() {
  if (window.location.hash.startsWith(prefix))
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
}

export function PlacementRecoveryGate({ children }: { children: ReactNode }) {
  const [reference, setReference] = useState<
    Reference | null | "invalid" | undefined
  >();
  useEffect(() => {
    const sync = () => setReference(placementReference(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  if (reference === undefined)
    return (
      <p className="sf-checkout-state" role="status">
        Checking previous checkout…
      </p>
    );
  if (reference === "invalid")
    return (
      <div className="sf-checkout-state" role="alert">
        <h2>Checkout recovery reference unavailable</h2>
        <p>
          This reference is incomplete. Check your orders or contact support
          before starting another checkout.
        </p>
        <Link href="/account/orders">Check your orders</Link>
      </div>
    );
  if (reference)
    return (
      <RecoveryPanel
        key={`${reference.cartId}:${reference.key}`}
        reference={reference}
        onRestart={() => setReference(null)}
      />
    );
  return children;
}

function RecoveryPanel({
  reference,
  onRestart,
}: {
  reference: Reference;
  onRestart: () => void;
}) {
  const [result, setResult] = useState<PlacementRecovery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false),
    alive = useRef(true);
  const alert = useRef<HTMLParagraphElement>(null);
  const { refreshCart } = useCart();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  const run = async (restart: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (restart) {
        // The server has already persisted the closure before a new form can open.
        await refreshCart();
        if (!alive.current) return;
        clearPlacementReference();
        onRestart();
      } else {
        const value = await checkoutApi.recoverPlacement(
          reference.cartId,
          reference.key,
        );
        if (alive.current) setResult(value);
      }
    } catch (error: unknown) {
      if (alive.current) setError(errorMessage(error));
    } finally {
      if (alive.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <section
      className="sf-checkout-state"
      aria-labelledby="placement-recovery-heading"
      aria-busy={busy || undefined}
    >
      <h2 id="placement-recovery-heading">
        {result?.status === "placed"
          ? "Your order was found"
          : result?.status === "cancelled"
            ? "Your previous attempt is closed"
            : "Check your previous checkout"}
      </h2>
      <p>
        {result?.status === "placed"
          ? "Your order was placed. Continue to its payment status without placing it again."
          : result?.status === "cancelled"
            ? "This attempt did not place an order and cannot complete later. Your cart has not been cleared by recovery. Review a fresh checkout before placing an order."
            : "Check the original attempt before starting another order. This either finds your order or closes an uncommitted attempt; it never places or pays for an order."}
      </p>
      {error && (
        <p ref={alert} role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
      {result?.status === "placed" ? (
        <Link
          className="sf-button"
          data-variant="primary"
          href={`/checkout/pay?order_id=${result.order_id}`}
          onClick={clearPlacementReference}
        >
          Continue to order
        </Link>
      ) : (
        <StorefrontButton
          busy={busy}
          onClick={() => void run(result?.status === "cancelled")}
        >
          {busy
            ? "Checking checkout…"
            : result?.status === "cancelled"
              ? "Start checkout again"
              : "Check original order"}
        </StorefrontButton>
      )}
      <p className="sf-checkout-note">
        Keep the original browser session for guest checkout. A recovery
        reference alone does not grant order access.
      </p>
    </section>
  );
}
