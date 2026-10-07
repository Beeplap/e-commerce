"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, errorMessage, paymentsApi } from "@/lib/api/client";
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

import {
  StorefrontButton,
  StorefrontInput,
} from "@/components/storefront/controls";
import { Money } from "@/components/ui/displays";
import { paymentEvidence } from "./evidence";

type PaymentFormProps = {
  orderId: string;
  orderNumber?: string;
  total?: string;
  currency?: string;
  onCaptured: (payment: PaymentRecord) => void;
};
export function PaymentForm({
  orderId,
  orderNumber,
  total,
  currency,
  onCaptured,
}: PaymentFormProps) {
  const [details, setDetails] = useState(
    total && currency && orderNumber ? { total, currency, orderNumber } : null,
  );
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false),
    alive = useRef(true);
  const intentKey = useRef<string | null>(null),
    intent = useRef<PaymentRecord | null>(null);
  const form = useRef<HTMLFormElement>(null),
    alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  const getIntent = async () => {
    if (!intentKey.current) intentKey.current = newIdempotencyKey("intent");
    const value = paymentEvidence(
      await paymentsApi.createIntent(orderId, intentKey.current),
      orderId,
    );
    if (alive.current) intent.current = value;
    return value;
  };
  // Guest reloads have no order-read API. This explicit existing intent command
  // retrieves the server amount for review; it does not confirm or charge.
  const reviewPayment = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const value = await getIntent();
      if (alive.current)
        setDetails({
          total: value.amount,
          currency: value.currency,
          orderNumber: value.order_number,
        });
    } catch (error: unknown) {
      if (alive.current) setError(errorMessage(error));
    } finally {
      if (alive.current) {
        inFlight.current = false;
        setSubmitting(false);
      }
    }
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || declined || !details) return;
    setError(null);
    const errors: Record<string, string> = {};
    if (!luhnValid(cardNumber))
      errors.cardNumber = "Enter a valid card number.";
    if (!expiryValid(expiry))
      errors.expiry = "Enter a valid, unexpired date (MM/YY).";
    if (!cvcValid(cvc)) errors.cvc = "Enter the 3 or 4 digit security code.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus(),
      );
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    const token = tokenizeCard(cardNumber);
    setCardNumber("");
    setExpiry("");
    setCvc("");
    try {
      const value = intent.current ?? (await getIntent());
      if (!alive.current) return;
      if (
        value.amount !== details.total ||
        value.currency !== details.currency
      ) {
        setDetails({
          total: value.amount,
          currency: value.currency,
          orderNumber: value.order_number,
        });
        setError(
          "The server returned an updated payment amount. Review it and enter your card details again before paying.",
        );
        return;
      }
      const confirmed = paymentEvidence(
        await paymentsApi.confirm(value.payment_id, intentKey.current!, token),
        orderId,
        value,
      );
      if (!alive.current) return;
      if (confirmed.status === "captured") {
        onCaptured(confirmed);
        return;
      }
      if (confirmed.status === "failed") {
        setDeclined(true);
        setError(confirmed.error_message || "Your payment was declined.");
      } else
        setError(
          "Payment is still processing. Check your order status before trying again.",
        );
    } catch (error: unknown) {
      if (!alive.current) return;
      if (error instanceof ApiError && error.status === 402) {
        setDeclined(true);
        setError(error.message || "Your payment was declined.");
      } else setError(errorMessage(error));
    } finally {
      if (alive.current) {
        inFlight.current = false;
        setSubmitting(false);
      }
    }
  };
  return (
    <form
      ref={form}
      onSubmit={handleSubmit}
      noValidate
      aria-label="Card payment"
      className="sf-checkout-payment-form"
      aria-busy={submitting || undefined}
    >
      <h2>Payment details</h2>
      {details ? (
        <div className="sf-checkout-payment-amount">
          <span>Order {details.orderNumber}</span>
          <strong data-testid="payment-amount">
            <Money amount={details.total} currency={details.currency} />
          </strong>
        </div>
      ) : (
        <p className="sf-checkout-note">
          Review the amount from the server before entering payment details.
          This uses your existing browser session and does not charge your card.
        </p>
      )}
      {error && (
        <div
          ref={alert}
          tabIndex={-1}
          role="alert"
          data-testid="payment-error"
          className="sf-checkout-alert"
        >
          <p>{error}</p>
          {declined && (
            <p data-testid="payment-declined-help">
              This order has been cancelled and its reserved items were
              released. No charge was made. Return to the{" "}
              <Link href="/cart">cart</Link> or <Link href="/search">shop</Link>{" "}
              to place a new order with a different payment method.
            </p>
          )}
        </div>
      )}
      {details ? (
        <>
          <div className="sf-checkout-card-fields">
            <StorefrontInput
              label="Card number"
              inputMode="numeric"
              autoComplete="cc-number"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              error={fieldErrors.cardNumber}
              maxLength={30}
              disabled={submitting || declined}
              placeholder="4242 4242 4242 4242"
            />
            <div className="sf-checkout-card-row">
              <StorefrontInput
                label="Expiry (MM/YY)"
                inputMode="numeric"
                autoComplete="cc-exp"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                error={fieldErrors.expiry}
                maxLength={7}
                disabled={submitting || declined}
                placeholder="12/35"
              />
              <StorefrontInput
                label="CVC"
                inputMode="numeric"
                autoComplete="cc-csc"
                type="password"
                value={cvc}
                onChange={(event) => setCvc(event.target.value)}
                error={fieldErrors.cvc}
                maxLength={4}
                disabled={submitting || declined}
                placeholder="123"
              />
            </div>
          </div>
          <StorefrontButton
            className="sf-checkout-submit"
            type="submit"
            busy={submitting}
            disabled={declined}
          >
            {submitting ? (
              "Processing payment…"
            ) : (
              <>
                Pay <Money amount={details.total} currency={details.currency} />
              </>
            )}
          </StorefrontButton>
        </>
      ) : (
        <StorefrontButton
          className="sf-checkout-submit"
          busy={submitting}
          onClick={() => void reviewPayment()}
        >
          {submitting ? "Reviewing payment…" : "Review payment"}
        </StorefrontButton>
      )}
      <p className="sf-checkout-note">
        Mock payment gateway. Card details are converted to a mock token in your
        browser; only that token is sent to Django. A production card gateway is
        not connected.
      </p>
      {!declined && error && (
        <p className="sf-checkout-note">
          Keep this browser session. Check your order status before retrying if
          the payment result is uncertain.
        </p>
      )}
    </form>
  );
}
