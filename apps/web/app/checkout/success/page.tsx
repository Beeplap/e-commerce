"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order_number") || "ORD-SUCCESS";
  const customerEmail = searchParams.get("email") || "your email";
  const total = searchParams.get("total") || "0.00";
  const currency = searchParams.get("currency") || "USD";

  return (
    <div className="mx-auto max-w-3xl w-full px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-8 sm:p-12 text-center shadow-sf-small">
        {/* Checkmark Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sf-success-surface text-sf-success">
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-black text-sf-foreground sm:text-3xl">
          Order Confirmed!
        </h1>
        <p className="mt-2 text-sm text-sf-soft">
          Thank you for shopping with us. We have received your order and
          notified each independent merchant.
        </p>

        {/* Order Details Card */}
        <div className="mt-8 rounded-sf-image bg-sf-background border border-sf-border p-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sf-border pb-4">
            <div>
              <span className="text-xs font-semibold text-sf-muted uppercase tracking-wider">
                Order Number
              </span>
              <p
                data-testid="success-order-number"
                className="text-lg font-mono font-bold text-sf-link"
              >
                {orderNumber}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold text-sf-muted uppercase tracking-wider">
                Total Paid
              </span>
              <p className="text-lg font-bold text-sf-foreground">
                ${total} {currency}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs text-sf-soft">
            <p>
              📧 A confirmation receipt has been sent to{" "}
              <strong className="text-sf-foreground">{customerEmail}</strong>.
            </p>
            <p>
              📦 Estimated delivery windows: <strong>2–5 business days</strong>{" "}
              depending on each seller&apos;s fulfillment location.
            </p>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/account"
            className="w-full sm:w-auto rounded-sf-image bg-sf-action px-6 py-3 text-sm font-bold text-sf-on-dark shadow-sf-small hover:bg-sf-action-hover transition"
          >
            Track My Orders
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto rounded-sf-image border border-sf-control bg-sf-surface px-6 py-3 text-sm font-bold text-sf-soft hover:bg-sf-background transition"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="sf-storefront min-h-screen flex flex-col bg-sf-background">
      <StorefrontHeader />
      <main id="storefront-content" tabIndex={-1} className="flex-1">
        <Suspense
          fallback={
            <div className="py-20 text-center text-sm text-sf-muted">
              Loading order details...
            </div>
          }
        >
          <SuccessContent />
        </Suspense>
      </main>
      <StorefrontFooter />
    </div>
  );
}
