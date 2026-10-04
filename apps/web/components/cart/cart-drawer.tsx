"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/features/cart/cart-context";

export function CartDrawer() {
  const { cart, isOpen, closeCart, updateQuantity, removeItem, isLoading } =
    useCart();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  const totalItems = cart?.total_items || 0;
  const sellers = cart?.sellers || [];
  const subtotal = cart?.subtotal || "0.00";
  const hasOutOfStock = cart?.has_out_of_stock_items || false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart Drawer"
      className="sf-storefront sf-cart-overlay fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="fixed inset-0 bg-sf-dark/60 backdrop-blur-sm transition-opacity animate-in fade-in"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-sf-surface shadow-sf-overlay flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-sf-border bg-sf-background/50">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-sf-foreground">
                Shopping Cart
              </h2>
              <span className="inline-flex items-center justify-center rounded-full bg-sf-accent-soft px-2.5 py-0.5 text-xs font-semibold text-sf-link">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            </div>
            <button
              type="button"
              onClick={closeCart}
              aria-label="Close cart"
              className="rounded-sf-control p-2 text-sf-muted hover:bg-sf-surface-strong hover:text-sf-soft transition"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-sf-border">
            {sellers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-16 w-16 rounded-full bg-sf-accent-soft flex items-center justify-center text-sf-link mb-4">
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
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-sf-foreground">
                  Your cart is empty
                </h3>
                <p className="mt-1 text-xs text-sf-muted max-w-xs">
                  Browse our high-quality catalog and discover verified products
                  from trusted marketplace sellers.
                </p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-6 rounded-sf-control bg-sf-action px-5 py-2.5 text-xs font-bold text-sf-on-dark shadow-sf-small hover:bg-sf-action-hover transition"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              sellers.map((seller) => (
                <div key={seller.seller_id} className="py-4 first:pt-0">
                  {/* Seller Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                      Seller:{" "}
                      <span className="text-sf-link">{seller.seller_name}</span>
                    </span>
                    <span className="text-xs font-semibold text-sf-soft">
                      ${seller.subtotal}
                    </span>
                  </div>

                  {/* Items for this seller */}
                  <div className="space-y-3">
                    {seller.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-3 rounded-sf-image border border-sf-border p-3 hover:border-sf-border transition bg-sf-surface"
                      >
                        {/* Thumbnail */}
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-sf-control bg-sf-surface-strong border border-sf-border relative">
                          {item.thumbnail_url ? (
                            <Image
                              src={item.thumbnail_url}
                              alt={item.product_title}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sf-muted">
                              <svg
                                className="h-6 w-6"
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

                        {/* Item Details */}
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <Link
                                href={`/products/${item.product_id}`}
                                onClick={closeCart}
                                className="text-xs font-bold text-sf-foreground hover:text-sf-link transition line-clamp-1"
                              >
                                {item.product_title}
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                disabled={isLoading}
                                aria-label={`Remove ${item.product_title}`}
                                className="text-sf-muted hover:text-sf-danger transition p-0.5"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                            <span className="text-[10px] text-sf-muted font-mono">
                              SKU: {item.sku}
                            </span>
                          </div>

                          {/* Stock Alert Warning */}
                          {item.stock_warning && (
                            <div
                              className={`mt-1 text-[10px] font-medium ${
                                item.is_available
                                  ? "text-sf-warning-text"
                                  : "text-sf-danger"
                              }`}
                            >
                              ⚠️ {item.stock_warning}
                            </div>
                          )}

                          {/* Quantity Controls & Line Price */}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center rounded-sf-control border border-sf-border bg-sf-background">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity - 1)
                                }
                                disabled={isLoading}
                                aria-label="Decrease quantity"
                                className="px-2 py-1 text-xs text-sf-soft hover:bg-sf-border rounded-l-lg transition"
                              >
                                -
                              </button>
                              <span
                                data-testid={`cart-drawer-qty-${item.id}`}
                                className="w-8 text-center text-xs font-semibold text-sf-foreground"
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
                                className="px-2 py-1 text-xs text-sf-soft hover:bg-sf-border rounded-r-lg transition disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs font-bold text-sf-foreground">
                              ${item.line_subtotal}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Checkout Actions */}
          {sellers.length > 0 && (
            <div className="border-t border-sf-border p-6 bg-sf-background space-y-4">
              {/* Out of Stock Guard Banner */}
              {hasOutOfStock && (
                <div className="rounded-sf-control bg-sf-danger-surface border border-sf-danger p-3 text-xs text-sf-danger font-medium">
                  Some items in your cart are currently out of stock or exceed
                  available quantities. Please adjust before checkout.
                </div>
              )}

              {/* Subtotal */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-sf-soft">
                  Subtotal
                </span>
                <span
                  data-testid="cart-drawer-subtotal"
                  className="text-lg font-bold text-sf-foreground"
                >
                  ${subtotal}
                </span>
              </div>
              <p className="text-[10px] text-sf-muted">
                Shipping, taxes, and promotional discounts calculated at
                checkout.
              </p>

              <div className="flex gap-2">
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="flex-1 text-center rounded-sf-image border border-sf-control bg-sf-surface px-4 py-2.5 text-xs font-bold text-sf-soft hover:bg-sf-background transition"
                >
                  View Full Cart
                </Link>
                <Link
                  href="/cart"
                  onClick={closeCart}
                  aria-disabled={hasOutOfStock}
                  className={`flex-1 text-center rounded-sf-image px-4 py-2.5 text-xs font-bold text-sf-on-dark shadow-sf-small transition ${
                    hasOutOfStock
                      ? "bg-sf-dark cursor-not-allowed pointer-events-none"
                      : "bg-sf-action hover:bg-sf-action-hover"
                  }`}
                >
                  Checkout
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
