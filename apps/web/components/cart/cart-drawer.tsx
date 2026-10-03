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
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Shopping Cart
              </h2>
              <span className="inline-flex items-center justify-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            </div>
            <button
              type="button"
              onClick={closeCart}
              aria-label="Close cart"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
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
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-slate-100">
            {sellers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mb-4">
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
                <h3 className="text-base font-bold text-slate-800">
                  Your cart is empty
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  Browse our high-quality catalog and discover verified products
                  from trusted marketplace sellers.
                </p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-6 rounded-lg bg-teal-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-900 transition"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              sellers.map((seller) => (
                <div key={seller.seller_id} className="py-4 first:pt-0">
                  {/* Seller Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Seller:{" "}
                      <span className="text-teal-900">
                        {seller.seller_name}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      ${seller.subtotal}
                    </span>
                  </div>

                  {/* Items for this seller */}
                  <div className="space-y-3">
                    {seller.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-3 rounded-xl border border-slate-100 p-3 hover:border-slate-200 transition bg-white"
                      >
                        {/* Thumbnail */}
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200 relative">
                          {item.thumbnail_url ? (
                            <Image
                              src={item.thumbnail_url}
                              alt={item.product_title}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
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
                                className="text-xs font-bold text-slate-800 hover:text-teal-700 transition line-clamp-1"
                              >
                                {item.product_title}
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                disabled={isLoading}
                                aria-label={`Remove ${item.product_title}`}
                                className="text-slate-400 hover:text-rose-600 transition p-0.5"
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
                            <span className="text-[10px] text-slate-500 font-mono">
                              SKU: {item.sku}
                            </span>
                          </div>

                          {/* Stock Alert Warning */}
                          {item.stock_warning && (
                            <div
                              className={`mt-1 text-[10px] font-medium ${
                                item.is_available
                                  ? "text-amber-700"
                                  : "text-rose-600"
                              }`}
                            >
                              ⚠️ {item.stock_warning}
                            </div>
                          )}

                          {/* Quantity Controls & Line Price */}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity - 1)
                                }
                                disabled={isLoading}
                                aria-label="Decrease quantity"
                                className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-l-lg transition"
                              >
                                -
                              </button>
                              <span
                                data-testid={`cart-drawer-qty-${item.id}`}
                                className="w-8 text-center text-xs font-semibold text-slate-800"
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
                                className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-r-lg transition disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs font-bold text-slate-900">
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
            <div className="border-t border-slate-200 p-6 bg-slate-50 space-y-4">
              {/* Out of Stock Guard Banner */}
              {hasOutOfStock && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-medium">
                  Some items in your cart are currently out of stock or exceed
                  available quantities. Please adjust before checkout.
                </div>
              )}

              {/* Subtotal */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Subtotal
                </span>
                <span
                  data-testid="cart-drawer-subtotal"
                  className="text-lg font-bold text-slate-900"
                >
                  ${subtotal}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Shipping, taxes, and promotional discounts calculated at
                checkout.
              </p>

              <div className="flex gap-2">
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="flex-1 text-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  View Full Cart
                </Link>
                <Link
                  href="/cart"
                  onClick={closeCart}
                  aria-disabled={hasOutOfStock}
                  className={`flex-1 text-center rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition ${
                    hasOutOfStock
                      ? "bg-slate-400 cursor-not-allowed pointer-events-none"
                      : "bg-teal-800 hover:bg-teal-900"
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
