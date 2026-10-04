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
    <div className="sf-storefront min-h-screen flex flex-col bg-sf-background">
      <StorefrontHeader />

      <main
        id="storefront-content"
        tabIndex={-1}
        className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8"
      >
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-xs text-sf-muted"
        >
          <Link href="/" className="hover:text-sf-link transition">
            Home
          </Link>
          <span>/</span>
          <span className="font-semibold text-sf-foreground">
            Shopping Cart
          </span>
        </nav>

        <div className="flex items-center justify-between mb-8 pb-4 border-b border-sf-border">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-sf-foreground sm:text-3xl">
              Shopping Cart
            </h1>
            <p className="mt-1 text-sm text-sf-muted">
              {totalItems} {totalItems === 1 ? "item" : "items"} in your cart
            </p>
          </div>
          {sellers.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              disabled={isLoading}
              className="text-xs font-semibold text-sf-danger hover:text-sf-danger hover:underline transition"
            >
              Clear Entire Cart
            </button>
          )}
        </div>

        {/* Out of Stock Warning Banner */}
        {hasOutOfStock && (
          <div className="mb-6 rounded-sf-image bg-sf-danger-surface border border-sf-danger p-4 text-sm text-sf-danger flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">Checkout is disabled</p>
              <p className="text-xs text-sf-danger mt-0.5">
                Some items in your cart exceed current available inventory or
                are out of stock. Please adjust quantities or remove unavailable
                items before proceeding.
              </p>
            </div>
          </div>
        )}

        {sellers.length === 0 ? (
          <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-12 text-center shadow-sf-small">
            <div className="mx-auto h-20 w-20 rounded-full bg-sf-accent-soft flex items-center justify-center text-sf-link mb-4">
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
            <h2 className="text-lg font-bold text-sf-foreground">
              Your cart is currently empty
            </h2>
            <p className="mt-2 text-sm text-sf-muted max-w-md mx-auto">
              Explore thousands of verified products from independent sellers
              across our fast commerce platform.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/"
                className="rounded-sf-image bg-sf-action px-6 py-3 text-sm font-bold text-sf-on-dark shadow-sf-small hover:bg-sf-action-hover transition"
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
                  className="rounded-sf-editorial border border-sf-border bg-sf-surface shadow-sf-small overflow-hidden"
                >
                  {/* Seller Header */}
                  <div className="bg-sf-background/80 px-6 py-3.5 border-b border-sf-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                        Seller
                      </span>
                      <Link
                        href={`/sellers/${seller.seller_id}`}
                        className="text-sm font-bold text-sf-link hover:underline"
                      >
                        {seller.seller_name}
                      </Link>
                    </div>
                    <span className="text-xs font-semibold text-sf-soft">
                      Seller Subtotal: ${seller.subtotal}
                    </span>
                  </div>

                  {/* Items for this seller */}
                  <div className="divide-y divide-sf-border p-6 space-y-6">
                    {seller.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row gap-4 pt-6 first:pt-0"
                      >
                        {/* Image */}
                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-sf-image bg-sf-surface-strong border border-sf-border relative">
                          {item.thumbnail_url ? (
                            <Image
                              src={item.thumbnail_url}
                              alt={item.product_title}
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sf-muted">
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
                                className="text-sm font-bold text-sf-foreground hover:text-sf-link transition"
                              >
                                {item.product_title}
                              </Link>
                              <span className="text-sm font-bold text-sf-foreground">
                                ${item.line_subtotal}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-sf-muted font-mono">
                              SKU: {item.sku}
                            </p>
                            <p className="text-xs text-sf-soft font-medium mt-1">
                              ${item.unit_price} each
                              {item.compare_at_price && (
                                <span className="ml-2 text-[11px] text-sf-muted line-through">
                                  ${item.compare_at_price}
                                </span>
                              )}
                            </p>

                            {/* Stock Warning */}
                            {item.stock_warning && (
                              <p
                                className={`mt-2 text-xs font-semibold ${
                                  item.is_available
                                    ? "text-sf-warning-text"
                                    : "text-sf-danger"
                                }`}
                              >
                                ⚠️ {item.stock_warning}
                              </p>
                            )}
                          </div>

                          {/* Controls */}
                          <div className="mt-4 flex items-center justify-between border-t border-sf-border pt-3">
                            <div className="flex items-center rounded-sf-control border border-sf-control bg-sf-surface">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity - 1)
                                }
                                disabled={isLoading}
                                aria-label="Decrease quantity"
                                className="px-3 py-1.5 text-xs font-bold text-sf-soft hover:bg-sf-surface-strong rounded-l-lg transition"
                              >
                                -
                              </button>
                              <span
                                data-testid={`cart-page-qty-${item.id}`}
                                className="w-10 text-center text-xs font-bold text-sf-foreground"
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
                                className="px-3 py-1.5 text-xs font-bold text-sf-soft hover:bg-sf-surface-strong rounded-r-lg transition disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={isLoading}
                              className="text-xs font-medium text-sf-muted hover:text-sf-danger transition"
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
              <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-6 shadow-sf-small">
                <h2 className="text-base font-bold text-sf-foreground border-b border-sf-border pb-4">
                  Order Summary
                </h2>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between text-sf-soft">
                    <span>Subtotal</span>
                    <span
                      data-testid="cart-summary-subtotal"
                      className="font-semibold text-sf-foreground"
                    >
                      ${cart?.subtotal || "0.00"}
                    </span>
                  </div>

                  <div className="flex justify-between text-sf-soft">
                    <span>Estimated Shipping</span>
                    <span className="font-semibold text-sf-success">FREE</span>
                  </div>

                  {couponResult?.valid && (
                    <div className="flex justify-between text-sf-success">
                      <span className="flex items-center gap-1">
                        Coupon ({couponCode.toUpperCase()})
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-[10px] text-sf-danger hover:underline"
                        >
                          (remove)
                        </button>
                      </span>
                      <span className="font-bold">
                        -${couponResult.discount_amount}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-sf-border pt-3 flex justify-between text-base font-bold text-sf-foreground">
                    <span>Total</span>
                    <span data-testid="cart-summary-total">${grandTotal}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    href="/checkout"
                    aria-disabled={hasOutOfStock || sellers.length === 0}
                    className={`block w-full text-center rounded-sf-image py-3.5 text-sm font-bold text-sf-on-dark shadow-sf-small transition ${
                      hasOutOfStock || sellers.length === 0
                        ? "bg-sf-border cursor-not-allowed pointer-events-none"
                        : "bg-sf-action hover:bg-sf-action-hover"
                    }`}
                  >
                    Proceed to Checkout
                  </Link>
                </div>

                <p className="mt-3 text-center text-[11px] text-sf-muted">
                  🔒 Encrypted checkout with authorized seller guarantees.
                </p>
              </div>

              {/* Promotional Coupon Box */}
              <div className="rounded-sf-editorial border border-sf-border bg-sf-surface p-6 shadow-sf-small">
                <h3 className="text-sm font-bold text-sf-foreground mb-3">
                  Promotional Coupon
                </h3>
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon code"
                    className="flex-1 rounded-sf-image border border-sf-control px-3.5 py-2 text-xs font-mono uppercase text-sf-foreground placeholder:text-sf-muted focus:border-sf-action focus:outline-none focus:ring-1 focus:ring-sf-action"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCode.trim()}
                    className="rounded-sf-image bg-sf-dark px-4 py-2 text-xs font-bold text-sf-on-dark hover:bg-sf-dark disabled:opacity-40 transition"
                  >
                    {couponLoading ? "..." : "Apply"}
                  </button>
                </form>

                {couponError && (
                  <p className="mt-2 text-xs text-sf-danger font-medium">
                    {couponError}
                  </p>
                )}

                {couponResult?.valid && (
                  <div className="mt-3 rounded-sf-control bg-sf-success-surface border border-sf-success p-2 text-xs font-semibold text-sf-success">
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
