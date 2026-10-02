"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { Money, DateDisplay } from "@/components/ui/displays";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import {
  getSellerOrder,
  confirmSellerOrder,
  beginProcessingSellerOrder,
  shipSellerOrder,
  deliverSellerOrder,
  cancelSellerOrder,
  type OrderItem,
} from "./api";

const inputStyle =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

const dangerButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <h2 className="mb-4 text-base font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

export function SellerOrderDetailView({ orderId }: { orderId: string }) {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead = access.permissions.includes("orders.read");
  const canUpdate = access.permissions.includes("orders.update");
  const canCancel = access.permissions.includes("orders.cancel");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return (
    <SellerOrderDetailContent
      key={`${access.id}-${orderId}`}
      sellerId={sellerId}
      orderId={orderId}
      canUpdate={canUpdate}
      canCancel={canCancel}
    />
  );
}

function SellerOrderDetailContent({
  sellerId,
  orderId,
  canUpdate,
  canCancel,
}: {
  sellerId: string;
  orderId: string;
  canUpdate: boolean;
  canCancel: boolean;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getSellerOrder(sellerId, orderId, signal),
    [sellerId, orderId],
  );
  const query = useApiQuery(`${sellerId}:order:${orderId}`, load);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Ship modal state
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Cancel modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const handleAction = async (actionFn: () => Promise<unknown>) => {
    try {
      setActionLoading(true);
      setActionError(null);
      await actionFn();
      query.retry();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to perform order action.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const onConfirm = () =>
    handleAction(() => confirmSellerOrder(sellerId, orderId));
  const onBeginProcessing = () =>
    handleAction(() => beginProcessingSellerOrder(sellerId, orderId));
  const onDeliver = () =>
    handleAction(() => deliverSellerOrder(sellerId, orderId));

  const onShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAction(async () => {
      await shipSellerOrder(sellerId, orderId, {
        carrier: carrier.trim() || undefined,
        tracking_number: trackingNumber.trim() || undefined,
      });
      setShipModalOpen(false);
      setCarrier("");
      setTrackingNumber("");
    });
  };

  const onCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setActionError("Please provide a reason for cancellation.");
      return;
    }
    await handleAction(async () => {
      await cancelSellerOrder(sellerId, orderId, cancelReason.trim());
      setCancelModalOpen(false);
      setCancelReason("");
    });
  };

  if (query.kind === "loading")
    return <LoadingState label="Loading order details…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const order = query.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/seller/orders"
          className="text-sm font-semibold text-teal-800 hover:underline"
        >
          &larr; Back to orders
        </Link>
        <div className="flex items-center gap-2">
          {canUpdate && order.status === "pending" && (
            <button
              type="button"
              className={primaryButton}
              disabled={actionLoading}
              onClick={onConfirm}
            >
              {actionLoading ? "Confirming..." : "Confirm Order"}
            </button>
          )}

          {canUpdate && order.status === "confirmed" && (
            <button
              type="button"
              className={primaryButton}
              disabled={actionLoading}
              onClick={onBeginProcessing}
            >
              {actionLoading ? "Processing..." : "Begin Processing"}
            </button>
          )}

          {canUpdate && order.status === "processing" && (
            <button
              type="button"
              className={primaryButton}
              disabled={actionLoading}
              onClick={() => setShipModalOpen(true)}
            >
              Ship Order
            </button>
          )}

          {canUpdate && order.status === "shipped" && (
            <button
              type="button"
              className={primaryButton}
              disabled={actionLoading}
              onClick={onDeliver}
            >
              {actionLoading ? "Delivering..." : "Mark Delivered"}
            </button>
          )}

          {canCancel &&
            (order.status === "pending" || order.status === "confirmed") && (
              <button
                type="button"
                className={dangerButton}
                disabled={actionLoading}
                onClick={() => setCancelModalOpen(true)}
              >
                Cancel Order
              </button>
            )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <PageHeader
        title={order.seller_order_number}
        description={`Parent Order: ${order.order_number} • Customer: ${order.customer_email}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            {order.status === "cancelled" && (
              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 uppercase">
                CANCELLED
              </span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Items and Timeline */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Items Table */}
          <Card title="Order Items">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Tax</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Net Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item: OrderItem) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {item.product_name_snapshot}
                        </div>
                        <div className="text-xs text-slate-500">
                          SKU: {item.sku_snapshot}
                        </div>
                      </td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3">
                        <Money
                          amount={item.unit_price}
                          currency={order.currency}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Money
                          amount={item.tax_amount}
                          currency={order.currency}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Money amount={item.total} currency={order.currency} />
                      </td>
                      <td className="px-4 py-3 font-medium text-teal-800">
                        <Money
                          amount={item.seller_net_amount}
                          currency={order.currency}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Timeline / Status History */}
          <Card title="Order Status History">
            {order.status_history.length === 0 ? (
              <p className="text-sm text-slate-500">
                No status transitions recorded.
              </p>
            ) : (
              <ul className="space-y-4">
                {order.status_history.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">
                        {h.from_status.toUpperCase()} &rarr;{" "}
                        {h.to_status.toUpperCase()}
                      </span>
                      {h.notes && (
                        <p className="mt-1 text-xs text-slate-600">{h.notes}</p>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      <DateDisplay value={h.created_at} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right Column: Financial Breakdown & Addresses */}
        <div className="space-y-6">
          {/* Financial Breakdown */}
          <Card title="Financial Summary">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <Money amount={order.subtotal} currency={order.currency} />
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discounts:</span>
                <span>
                  -
                  <Money
                    amount={order.discount_total}
                    currency={order.currency}
                  />
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax:</span>
                <Money amount={order.tax_total} currency={order.currency} />
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping:</span>
                <Money
                  amount={order.shipping_total}
                  currency={order.currency}
                />
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Platform Commission:</span>
                <span>
                  -
                  <Money
                    amount={order.commission_total}
                    currency={order.currency}
                  />
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 font-bold text-slate-900">
                <span>Seller Net Total:</span>
                <span className="text-teal-800">
                  <Money
                    amount={order.seller_net_total}
                    currency={order.currency}
                  />
                </span>
              </div>
            </div>
          </Card>

          {/* Shipping Address */}
          <Card title="Shipping Address">
            {Object.keys(order.shipping_address_snapshot).length === 0 ? (
              <p className="text-sm text-slate-500">
                No shipping address recorded.
              </p>
            ) : (
              <pre className="font-sans text-xs whitespace-pre-wrap text-slate-700">
                {JSON.stringify(order.shipping_address_snapshot, null, 2)}
              </pre>
            )}
          </Card>

          {/* Billing Address */}
          <Card title="Billing Address">
            {Object.keys(order.billing_address_snapshot).length === 0 ? (
              <p className="text-sm text-slate-500">
                No billing address recorded.
              </p>
            ) : (
              <pre className="font-sans text-xs whitespace-pre-wrap text-slate-700">
                {JSON.stringify(order.billing_address_snapshot, null, 2)}
              </pre>
            )}
          </Card>
        </div>
      </div>

      {/* Ship Modal */}
      {shipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Fulfill & Ship Order
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Provide shipment details to notify the customer and consume
              reserved stock.
            </p>
            <form onSubmit={onShipSubmit} className="mt-4 space-y-4">
              <FormField
                label="Carrier Name (e.g. DHL, Fedex, Nepal Express)"
                placeholder="Carrier name"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
              <FormField
                label="Tracking Number"
                placeholder="Tracking code"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setShipModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={primaryButton}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Fulfilling..." : "Confirm Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Cancel Order</h3>
            <p className="mt-1 text-sm text-slate-500">
              This will release all reserved inventory items back into available
              stock.
            </p>
            <form onSubmit={onCancelSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="cancel-reason"
                  className="mb-1 block text-sm font-medium text-slate-800"
                >
                  Cancellation Reason *
                </label>
                <textarea
                  id="cancel-reason"
                  rows={3}
                  className={inputStyle}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explain why this order is being cancelled..."
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setCancelModalOpen(false)}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className={dangerButton}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
