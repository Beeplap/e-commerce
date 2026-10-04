"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { ApiError, paymentsApi } from "@/lib/api/client";
import type { PaymentRecord } from "@/lib/api/types";

/**
 * Mock gateway card form.
 *
 * Card number, expiry and CVC are validated locally and converted into an opaque
 * token. They are never sent to Django or written to browser storage. A real
 * provider integration would replace `tokenizeCard` with the provider's hosted
 * fields/SDK so raw card data never touches this origin at all.
 */

export function luhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\s+/g, "");
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function expiryValid(expiry: string, now: Date = new Date()): boolean {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

export function cvcValid(cvc: string): boolean {
  return /^\d{3,4}$/.test(cvc.trim());
}

function tokenizeCard(cardNumber: string): string {
  const digits = cardNumber.replace(/\s+/g, "");
  return `tok_mock_${digits.slice(-4)}`;
}

function newIdempotencyKey(prefix: string): string {
  const raw =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${raw.replace(/[^A-Za-z0-9]/g, "")}`;
}

type PaymentFormProps = {
  orderId: string;
  orderNumber: string;
  total: string;
  currency: string;
  onCaptured: (payment: PaymentRecord) => void;
};

export function PaymentForm({
  orderId,
  orderNumber,
  total,
  currency,
  onCaptured,
}: PaymentFormProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard: state updates are async, so a fast double click could
  // otherwise dispatch two requests before the button re-renders disabled.
  const inFlight = useRef(false);
  // One intent key per order view: retries after network errors replay the same
  // intent instead of creating a second payment.
  const intentKey = useRef<string | null>(null);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!luhnValid(cardNumber))
      errors.cardNumber = "Enter a valid card number.";
    if (!expiryValid(expiry))
      errors.expiry = "Enter a valid, unexpired date (MM/YY).";
    if (!cvcValid(cvc)) errors.cvc = "Enter the 3 or 4 digit security code.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || declined) return;
    setError(null);
    if (!validate()) return;

    inFlight.current = true;
    setSubmitting(true);
    const token = tokenizeCard(cardNumber);
    // Drop sensitive input from component state as soon as it is tokenized.
    setCardNumber("");
    setCvc("");
    try {
      if (!intentKey.current) intentKey.current = newIdempotencyKey("intent");
      const intent = await paymentsApi.createIntent(orderId, intentKey.current);
      const confirmed = await paymentsApi.confirm(
        intent.payment_id,
        intentKey.current,
        token,
      );
      if (confirmed.status === "captured") {
        onCaptured(confirmed);
        return;
      }
      if (confirmed.status === "failed") {
        setDeclined(true);
        setError(confirmed.error_message || "Your payment was declined.");
      } else {
        setError(
          "Payment is still processing. Check your order status before trying again.",
        );
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 402) {
        setDeclined(true);
        setError(err.message || "Your payment was declined.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Payment could not be completed. Please try again.");
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-sf-image border border-sf-control px-3.5 py-2 text-sm text-sf-foreground focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Card payment"
      className="rounded-sf-editorial border border-sf-border bg-sf-surface p-6 shadow-sf-small"
    >
      <h2 className="text-base font-bold text-sf-foreground">
        Payment details
      </h2>
      <p className="mt-1 text-xs text-sf-muted">
        Order <span className="font-mono">{orderNumber}</span> · Amount due{" "}
        <strong data-testid="payment-amount">
          {total} {currency}
        </strong>
      </p>

      {error && (
        <div
          role="alert"
          data-testid="payment-error"
          className="mt-4 rounded-sf-image border border-sf-danger bg-sf-danger-surface p-4 text-sm text-sf-danger"
        >
          <p>{error}</p>
          {declined && (
            <p className="mt-2" data-testid="payment-declined-help">
              This order has been cancelled and its reserved items were
              released. No charge was made. Return to the{" "}
              <Link href="/cart" className="font-semibold underline">
                cart
              </Link>{" "}
              or{" "}
              <Link href="/" className="font-semibold underline">
                shop
              </Link>{" "}
              to place a new order with a different payment method.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="cardNumber"
            className="mb-1 block text-xs font-bold text-sf-soft"
          >
            Card number
          </label>
          <input
            id="cardNumber"
            inputMode="numeric"
            autoComplete="cc-number"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            aria-invalid={Boolean(fieldErrors.cardNumber)}
            aria-describedby={
              fieldErrors.cardNumber ? "cardNumber-error" : undefined
            }
            disabled={submitting || declined}
            className={inputClass}
            placeholder="4242 4242 4242 4242"
          />
          {fieldErrors.cardNumber && (
            <p id="cardNumber-error" className="mt-1 text-xs text-sf-danger">
              {fieldErrors.cardNumber}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="expiry"
              className="mb-1 block text-xs font-bold text-sf-soft"
            >
              Expiry (MM/YY)
            </label>
            <input
              id="expiry"
              autoComplete="cc-exp"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              aria-invalid={Boolean(fieldErrors.expiry)}
              aria-describedby={fieldErrors.expiry ? "expiry-error" : undefined}
              disabled={submitting || declined}
              className={inputClass}
              placeholder="12/30"
            />
            {fieldErrors.expiry && (
              <p id="expiry-error" className="mt-1 text-xs text-sf-danger">
                {fieldErrors.expiry}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="cvc"
              className="mb-1 block text-xs font-bold text-sf-soft"
            >
              CVC
            </label>
            <input
              id="cvc"
              inputMode="numeric"
              autoComplete="cc-csc"
              type="password"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              aria-invalid={Boolean(fieldErrors.cvc)}
              aria-describedby={fieldErrors.cvc ? "cvc-error" : undefined}
              disabled={submitting || declined}
              className={inputClass}
              placeholder="123"
            />
            {fieldErrors.cvc && (
              <p id="cvc-error" className="mt-1 text-xs text-sf-danger">
                {fieldErrors.cvc}
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || declined}
        className="mt-6 w-full rounded-sf-image bg-sf-action py-3.5 text-sm font-bold text-sf-on-dark shadow-sf-small transition hover:bg-sf-action-hover disabled:opacity-40"
      >
        {submitting ? "Processing payment..." : `Pay ${total} ${currency}`}
      </button>
      <p className="mt-3 text-center text-[11px] text-sf-muted">
        Card details are tokenized in your browser and never sent to our
        servers.
      </p>
    </form>
  );
}
