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
      <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-sm">
        {/* Checkmark Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
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

        <h1 className="mt-6 text-2xl font-black text-slate-900 sm:text-3xl">
          Order Confirmed!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Thank you for shopping with us. We have received your order and
          notified each independent merchant.
        </p>

        {/* Order Details Card */}
        <div className="mt-8 rounded-xl bg-slate-50 border border-slate-200 p-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Order Number
              </span>
              <p
                data-testid="success-order-number"
                className="text-lg font-mono font-bold text-teal-900"
              >
                {orderNumber}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Paid
              </span>
              <p className="text-lg font-bold text-slate-900">
                ${total} {currency}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <p>
              📧 A confirmation receipt has been sent to{" "}
              <strong className="text-slate-800">{customerEmail}</strong>.
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
            className="w-full sm:w-auto rounded-xl bg-teal-800 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-900 transition"
          >
            Track My Orders
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="py-20 text-center text-sm text-slate-400">
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
