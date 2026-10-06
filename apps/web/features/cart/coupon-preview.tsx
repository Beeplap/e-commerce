"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { promotionsApi, errorMessage } from "@/lib/api/client";
import { Money } from "@/components/ui/displays";
import {
  StorefrontButton,
  StorefrontInput,
} from "@/components/storefront/controls";
import { couponEvidence } from "./evidence";

export function CouponPreview({
  subtotal,
  currency,
  busy,
}: {
  subtotal: string;
  currency: string;
  busy: boolean;
}) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ code: string; amount: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const alive = useRef(false),
    flight = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const check = async (event: FormEvent) => {
    event.preventDefault();
    if (flight.current || busy) return;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) {
      setError(
        "Enter a code of 3–32 letters, numbers, hyphens or underscores.",
      );
      return;
    }
    flight.current = true;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const preview = couponEvidence(
        await promotionsApi.validateCoupon(normalized, null, subtotal),
        subtotal,
      );
      if (alive.current) {
        if (preview.valid)
          setResult({ code: normalized, amount: preview.discount_amount });
        else setError(preview.error_message || "This code is not eligible.");
      }
    } catch (error: unknown) {
      if (alive.current) setError(errorMessage(error));
    } finally {
      flight.current = false;
      if (alive.current) setPending(false);
    }
  };
  return (
    <section className="sf-cart-coupon" aria-label="Promo code eligibility">
      <form
        onSubmit={(event) => {
          void check(event);
        }}
      >
        <fieldset disabled={busy || pending}>
          <StorefrontInput
            label="Check a promo code"
            placeholder="Enter coupon code"
            value={code}
            maxLength={32}
            autoComplete="off"
            onChange={(event) => {
              setCode(event.target.value);
              setResult(null);
              setError(null);
            }}
          />
          <StorefrontButton
            variant="secondary"
            type="submit"
            busy={pending}
            disabled={!code.trim()}
          >
            {pending ? "Checking…" : "Check code"}
          </StorefrontButton>
        </fieldset>
      </form>
      <p className="sf-cart-note">
        Eligibility preview only. This does not apply a code to your cart.
        Checkout determines any actual discounts.
      </p>
      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="sf-cart-error">
          {error}
        </p>
      )}
      {result && !busy && (
        <div role="status" className="sf-cart-coupon-result">
          <p>
            <strong>{result.code}</strong> is eligible for a preview discount of{" "}
            <Money amount={result.amount} currency={currency} />.
          </p>
          <StorefrontButton
            variant="quiet"
            onClick={() => {
              setCode("");
              setResult(null);
            }}
          >
            Remove preview
          </StorefrontButton>
        </div>
      )}
    </section>
  );
}
