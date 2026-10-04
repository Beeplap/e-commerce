"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { PaymentForm } from "@/features/checkout/payment-form";
import type { PaymentRecord } from "@/lib/api/types";

function PayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id") || "";
  const orderNumber = searchParams.get("order_number") || "";
  const total = searchParams.get("total") || "0.00";
  const currency = searchParams.get("currency") || "USD";
  const email = searchParams.get("email") || "";

  if (!orderId) {
    return (
      <div className="mx-auto max-w-lg w-full px-4 py-16 text-center">
        <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-8 shadow-sf-small">
          <h1 className="text-lg font-bold text-sf-foreground">
            No pending order found
          </h1>
          <p className="mt-2 text-xs text-sf-muted">
            You must place an order before proceeding to payment.
          </p>
          <div className="mt-6">
            <Link
              href="/cart"
              className="rounded-sf-image bg-sf-action px-5 py-2.5 text-xs font-bold text-sf-on-dark shadow-sf-small hover:bg-sf-action-hover transition"
            >
              Return to Cart
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleCaptured = (payment: PaymentRecord) => {
    router.push(
      `/checkout/success?order_id=${payment.order_id}&order_number=${encodeURIComponent(
        payment.order_number,
      )}&email=${encodeURIComponent(email)}&total=${payment.amount}&currency=${
        payment.currency
      }`,
    );
  };

  return (
    <div className="mx-auto max-w-xl w-full px-4 py-12 sm:px-6">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-xs text-sf-muted"
      >
        <Link href="/" className="hover:text-sf-link transition">
          Home
        </Link>
        <span>/</span>
        <Link href="/cart" className="hover:text-sf-link transition">
          Cart
        </Link>
        <span>/</span>
        <span className="font-semibold text-sf-foreground">Payment</span>
      </nav>

      <PaymentForm
        orderId={orderId}
        orderNumber={orderNumber}
        total={total}
        currency={currency}
        onCaptured={handleCaptured}
      />
    </div>
  );
}

export default function CheckoutPayPage() {
  return (
    <div className="sf-storefront min-h-screen flex flex-col bg-sf-background">
      <StorefrontHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="py-20 text-center text-sm text-sf-muted">
              Loading payment...
            </div>
          }
        >
          <PayContent />
        </Suspense>
      </main>
      <StorefrontFooter />
    </div>
  );
}
