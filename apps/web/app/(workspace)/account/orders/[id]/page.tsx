"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { WorkspaceFrame } from "@/features/workspaces/workspace-frame";
import { DeliveryStepper } from "@/features/account/delivery-stepper";
import { ReviewModal } from "@/features/account/review-modal";
import { ReturnModal } from "@/features/account/return-modal";
import { customerApi } from "@/lib/api/client";
import type { CustomerOrderDetail, CustomerOrderItem } from "@/lib/api/types";

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const orderId = String(params.id);

  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [reviewItem, setReviewItem] = useState<CustomerOrderItem | null>(null);
  const [returnItem, setReturnItem] = useState<CustomerOrderItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetchOrder = () => setRefetchTrigger((c) => c + 1);

  useEffect(() => {
    let active = true;
    customerApi
      .getOrder(orderId)
      .then((data) => {
        if (!active) return;
        setOrder(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load order details.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId, refetchTrigger]);

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    setError(null);
    try {
      const updated = await customerApi.cancelOrder(order.id, cancelReason);
      setOrder(updated);
      setShowCancelPrompt(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to cancel order.");
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <WorkspaceFrame mode="account">
      {/* Navigation Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-2 text-xs text-slate-500"
      >
        <Link href="/account" className="hover:text-teal-700 transition">
          Account
        </Link>
        <span>/</span>
        <Link href="/account/orders" className="hover:text-teal-700 transition">
          Orders
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800 font-mono">
          {order?.order_number || "Details"}
        </span>
      </nav>

      {error && (
        <div
          role="alert"
          data-testid="order-detail-error"
          className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">
          Loading order details...
        </div>
      ) : !order ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h2 className="text-base font-bold text-slate-900">
            Order not found
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            This order may have been removed or does not belong to your account.
          </p>
          <div className="mt-6">
            <Link
              href="/account/orders"
              className="rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-900 transition"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Order Header Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Order Number
                </span>
                <h1
                  data-testid="order-detail-number"
                  className="font-mono text-xl font-black text-slate-900"
                >
                  {order.order_number}
                </h1>
                <p className="mt-0.5 text-xs text-slate-400">
                  Placed on {new Date(order.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  data-testid="order-detail-status"
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    order.status === "cancelled"
                      ? "bg-rose-100 text-rose-800"
                      : order.status === "delivered"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-teal-100 text-teal-800"
                  }`}
                >
                  {order.status}
                </span>

                {order.status === "pending" && (
                  <button
                    type="button"
                    data-testid="cancel-order-button"
                    onClick={() => setShowCancelPrompt(true)}
                    className="rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>

            {/* Cancel Prompt Dialog */}
            {showCancelPrompt && (
              <div
                data-testid="cancel-order-dialog"
                className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4"
              >
                <h3 className="text-xs font-bold text-rose-900">
                  Are you sure you want to cancel this order?
                </h3>
                <p className="mt-1 text-xs text-rose-700">
                  Cancelling will immediately release held inventory
                  reservations. This action cannot be undone.
                </p>
                <div className="mt-3">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation (optional)"
                    className="w-full rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={cancelling}
                    data-testid="confirm-cancel-button"
                    onClick={handleCancelOrder}
                    className="rounded-lg bg-rose-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50 transition"
                  >
                    {cancelling ? "Cancelling..." : "Confirm Cancellation"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelPrompt(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delivery Stepper & Packages */}
          {order.packages.map((pkg) => (
            <div key={pkg.seller_order_id} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Package from: {pkg.seller_name}
                </h2>
                <span className="text-xs font-semibold text-slate-500">
                  Status: {pkg.status}
                </span>
              </div>

              {/* Progress Stepper & Carrier Events */}
              <DeliveryStepper
                status={pkg.status}
                carrier={pkg.carrier}
                trackingNumber={pkg.tracking_number}
                trackingEvents={pkg.tracking_events}
              />

              {/* Package Items Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Product Item</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pkg.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">
                            {item.product_title}
                          </p>
                          <p className="text-slate-400 font-mono text-[11px]">
                            {item.variant_name}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {item.sku}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          ${item.total_price}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.can_review && (
                              <button
                                type="button"
                                data-testid={`write-review-btn-${item.id}`}
                                onClick={() => setReviewItem(item)}
                                className="rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-100 transition"
                              >
                                Write Review
                              </button>
                            )}
                            {item.can_return && (
                              <button
                                type="button"
                                data-testid={`request-return-btn-${item.id}`}
                                onClick={() => setReturnItem(item)}
                                className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition"
                              >
                                Request Return
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Financial Totals & Addresses Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Payment Summary
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    ${order.subtotal}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Shipping Total</span>
                  <span className="font-semibold text-slate-900">
                    ${order.shipping_total}
                  </span>
                </div>
                {parseFloat(order.discount_total) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span className="font-bold">-${order.discount_total}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-slate-900">
                  <span>Total Amount</span>
                  <span data-testid="order-detail-total">
                    ${order.grand_total} {order.currency}
                  </span>
                </div>
                <div className="pt-2 text-[11px] text-slate-400">
                  Payment Status:{" "}
                  <strong className="uppercase text-slate-600">
                    {order.payment_status}
                  </strong>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Shipping Destination
              </h3>
              {order.shipping_address ? (
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-900">
                    {String(order.shipping_address.full_name || "")}
                  </p>
                  <p>{String(order.shipping_address.line1 || "")}</p>
                  {Boolean(order.shipping_address.line2) && (
                    <p>{String(order.shipping_address.line2)}</p>
                  )}
                  <p>
                    {String(order.shipping_address.city || "")},{" "}
                    {String(order.shipping_address.state || "")}{" "}
                    {String(order.shipping_address.postal_code || "")},{" "}
                    {String(order.shipping_address.country || "")}
                  </p>
                  <p className="font-mono text-slate-400">
                    {String(order.shipping_address.phone || "")}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Standard delivery address.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewItem && (
        <ReviewModal
          isOpen={Boolean(reviewItem)}
          onClose={() => setReviewItem(null)}
          orderItemId={reviewItem.id}
          productTitle={reviewItem.product_title}
          onSuccess={refetchOrder}
        />
      )}

      {/* Return Modal */}
      {returnItem && (
        <ReturnModal
          isOpen={Boolean(returnItem)}
          onClose={() => setReturnItem(null)}
          orderItemId={returnItem.id}
          productTitle={returnItem.product_title}
          maxQuantity={returnItem.quantity}
          onSuccess={refetchOrder}
        />
      )}
    </WorkspaceFrame>
  );
}
