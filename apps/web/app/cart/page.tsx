"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/features/cart/cart-context";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { promotionsApi } from "@/lib/api/client";
import type { CouponValidationResult } from "@/lib/api/types";

export default function CartPage() {
  const { cart, updateQuantity, removeItem, clearCart, isLoading } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] =
    useState<CouponValidationResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const sellers = cart?.sellers || [];
  const totalItems = cart?.total_items || 0;
  const subtotalNumber = parseFloat(cart?.subtotal || "0.00");
  const hasOutOfStock = cart?.has_out_of_stock_items || false;

  const discountNumber = couponResult?.valid
    ? parseFloat(couponResult.discount_amount)
    : 0;
  const estimatedShipping = 0.0;
  const grandTotal = Math.max(
    0,
    subtotalNumber - discountNumber + estimatedShipping,
  ).toFixed(2);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await promotionsApi.validateCoupon(
        couponCode.trim().toUpperCase(),
        null,
        cart?.subtotal || "0.00",
      );
      if (res.valid) {
        setCouponResult(res);
        setCouponError(null);
      } else {
        setCouponResult(null);
        setCouponError(
          res.error_message || "Invalid or expired promotional code.",
        );
      }
    } catch {
      setCouponResult(null);
      setCouponError("Unable to validate coupon at this time.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    setCouponResult(null);
    setCouponError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <StorefrontHeader />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-xs text-slate-500"
        >
          <Link href="/" className="hover:text-orange-700 transition">
            Home
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-800">Shopping Cart</span>
        </nav>

        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Shopping Cart
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {totalItems} {totalItems === 1 ? "item" : "items"} in your cart
            </p>
          </div>
          {sellers.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              disabled={isLoading}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline transition"
            >
              Clear Entire Cart
            </button>
          )}
        </div>

        {/* Out of Stock Warning Banner */}
        {hasOutOfStock && (
          <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">Checkout is disabled</p>
              <p className="text-xs text-rose-700 mt-0.5">
                Some items in your cart exceed current available inventory or
                are out of stock. Please adjust quantities or remove unavailable
                items before proceeding.
              </p>
            </div>
          </div>
        )}

        {sellers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-ui-surface p-12 text-center shadow-sm">
            <div className="mx-auto h-20 w-20 rounded-full bg-orange-50 flex items-center justify-center text-orange-700 mb-4">
              <svg
                className="h-10 w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Your cart is currently empty
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Explore thousands of verified products from independent sellers
              across our fast commerce platform.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/"
                className="rounded-xl bg-orange-800 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-900 transition"
              >
                Explore Catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            {/* Items List (Left 8 Cols) */}
            <div className="lg:col-span-8 space-y-6">
              {sellers.map((seller) => (
                <div
                  key={seller.seller_id}
                  className="rounded-2xl border border-slate-200 bg-ui-surface shadow-sm overflow-hidden"
                >
                  {/* Seller Header */}
                  <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Seller
                      </span>
                      <Link
                        href={`/sellers/${seller.seller_id}`}
                        className="text-sm font-bold text-orange-900 hover:underline"
                      >
                        {seller.seller_name}
                      </Link>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      Seller Subtotal: ${seller.subtotal}
                    </span>
                  </div>

                  {/* Items for this seller */}
                  <div className="divide-y divide-slate-100 p-6 space-y-6">
                    {seller.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row gap-4 pt-6 first:pt-0"
                      >
                        {/* Image */}
                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200 relative">
                          {item.thumbnail_url ? (
                            <Image
                              src={item.thumbnail_url}
                              alt={item.product_title}
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <svg
                                className="h-8 w-8"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/products/${item.product_id}`}
                                className="text-sm font-bold text-slate-900 hover:text-orange-700 transition"
                              >
                                {item.product_title}
                              </Link>
                              <span className="text-sm font-bold text-slate-900">
                                ${item.line_subtotal}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 font-mono">
                              SKU: {item.sku}
                            </p>
                            <p className="text-xs text-slate-600 font-medium mt-1">
                              ${item.unit_price} each
                              {item.compare_at_price && (
                                <span className="ml-2 text-[11px] text-slate-400 line-through">
                                  ${item.compare_at_price}
                                </span>
                              )}
                            </p>

                            {/* Stock Warning */}
                            {item.stock_warning && (
                              <p
                                className={`mt-2 text-xs font-semibold ${
                                  item.is_available
                                    ? "text-amber-700"
                                    : "text-rose-600"
                                }`}
                              >
                                ⚠️ {item.stock_warning}
                              </p>
                            )}
                          </div>

                          {/* Controls */}
                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                            <div className="flex items-center rounded-lg border border-slate-300 bg-ui-surface">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity - 1)
                                }
                                disabled={isLoading}
                                aria-label="Decrease quantity"
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-l-lg transition"
                              >
                                -
                              </button>
                              <span
                                data-testid={`cart-page-qty-${item.id}`}
                                className="w-10 text-center text-xs font-bold text-slate-800"
                              >
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity + 1)
                                }
                                disabled={
                                  isLoading ||
                                  item.quantity >= item.available_stock
                                }
                                aria-label="Increase quantity"
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-r-lg transition disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={isLoading}
                              className="text-xs font-medium text-slate-500 hover:text-rose-600 transition"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary & Coupon (Right 4 Cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Order Summary Card */}
              <div className="rounded-2xl border border-slate-200 bg-ui-surface p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-4">
                  Order Summary
                </h2>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span
                      data-testid="cart-summary-subtotal"
                      className="font-semibold text-slate-900"
                    >
                      ${cart?.subtotal || "0.00"}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Estimated Shipping</span>
                    <span className="font-semibold text-emerald-700">FREE</span>
                  </div>

                  {couponResult?.valid && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="flex items-center gap-1">
                        Coupon ({couponCode.toUpperCase()})
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-[10px] text-rose-500 hover:underline"
                        >
                          (remove)
                        </button>
                      </span>
                      <span className="font-bold">
                        -${couponResult.discount_amount}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-900">
                    <span>Total</span>
                    <span data-testid="cart-summary-total">${grandTotal}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    href="/checkout"
                    aria-disabled={hasOutOfStock || sellers.length === 0}
                    className={`block w-full text-center rounded-xl py-3.5 text-sm font-bold text-white shadow-sm transition ${
                      hasOutOfStock || sellers.length === 0
                        ? "bg-slate-300 cursor-not-allowed pointer-events-none"
                        : "bg-orange-800 hover:bg-orange-900"
                    }`}
                  >
                    Proceed to Checkout
                  </Link>
                </div>

                <p className="mt-3 text-center text-[11px] text-slate-500">
                  🔒 Encrypted checkout with authorized seller guarantees.
                </p>
              </div>

              {/* Promotional Coupon Box */}
              <div className="rounded-2xl border border-slate-200 bg-ui-surface p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  Promotional Coupon
                </h3>
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon code"
                    className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-mono uppercase text-slate-800 placeholder:text-slate-400 focus:border-orange-700 focus:outline-none focus:ring-1 focus:ring-ui-focus"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCode.trim()}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition"
                  >
                    {couponLoading ? "..." : "Apply"}
                  </button>
                </form>

                {couponError && (
                  <p className="mt-2 text-xs text-rose-600 font-medium">
                    {couponError}
                  </p>
                )}

                {couponResult?.valid && (
                  <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs font-semibold text-emerald-800">
                    ✓ Coupon applied! Saved ${couponResult.discount_amount}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
}
