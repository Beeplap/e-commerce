"use client";

import { Dialog } from "@/components/ui/dialog";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DateDisplay } from "@/components/ui/displays";
import { Identifier } from "@/components/ui/identifier";
import {
  DetailSection,
  DetailGrid,
  SplitLayout,
} from "@/components/ui/detail-layout";
import { Timeline } from "@/components/ui/timeline";
import { RecordDetails } from "@/components/ui/record-details";
import { OrderItems, OrderTotals } from "./order-sections";
import { RelatedOrderWork } from "./related-order-work";
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
} from "./api";

const inputStyle =
  "min-h-11 w-full rounded-lg border border-ui-control-border bg-ui-surface px-3 py-2 text-sm text-ui-foreground focus:border-teal-700 focus:outline-none";

const dangerButton =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

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
      sellerName={access.seller.display_name}
      canReadShipments={access.permissions.includes("fulfillment.read")}
      canReadReturns={access.permissions.includes("returns.read")}
    />
  );
}

function SellerOrderDetailContent({
  sellerId,
  orderId,
  canUpdate,
  canCancel,
  sellerName,
  canReadShipments,
  canReadReturns,
}: {
  sellerId: string;
  orderId: string;
  canUpdate: boolean;
  canCancel: boolean;
  sellerName: string;
  canReadShipments: boolean;
  canReadReturns: boolean;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getSellerOrder(sellerId, orderId, signal),
    [sellerId, orderId],
  );
  const query = useApiQuery(`${sellerId}:order:${orderId}`, load);

  const [actionLoading, setActionLoading] = useState(false);
  const actionInFlight = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Ship modal state
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Cancel modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const handleAction = async (actionFn: () => Promise<unknown>) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
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
      actionInFlight.current = false;
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
    return <LoadingState variant="detail" label="Loading order details…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const order = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/seller/orders"
          className="text-sm font-semibold text-ui-accent hover:underline"
        >
          &larr; Back to orders
        </Link>
        <div className="flex flex-wrap items-center gap-2">
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

      {actionError && !shipModalOpen && !cancelModalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <PageHeader
        title={order.seller_order_number}
        description={`${sellerName} · Customer: ${order.customer_email}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge
              status={order.status === "cancelled" ? "CANCELLED" : order.status}
            />
          </div>
        }
      />

      <DetailGrid
        items={[
          {
            label: "Parent Order",
            value: <Identifier value={order.order_number} copyable />,
          },
          { label: "Created", value: <DateDisplay value={order.created_at} /> },
        ]}
      />
      <SplitLayout
        asideLabel="Financial and customer information"
        aside={
          <>
            <DetailSection title="Financial Summary">
              <OrderTotals
                values={order}
                currency={order.currency}
                total={order.seller_net_total}
                totalLabel="Seller Net Total"
              />
            </DetailSection>
            <DetailSection title="Shipping Address">
              <RecordDetails
                value={order.shipping_address_snapshot}
                emptyMessage="No shipping address recorded."
              />
            </DetailSection>
            <DetailSection title="Billing Address">
              <RecordDetails
                value={order.billing_address_snapshot}
                emptyMessage="No billing address recorded."
              />
            </DetailSection>
            <DetailSection title="Order metadata">
              <DetailGrid
                items={[
                  {
                    label: "Seller Order ID",
                    value: <Identifier value={order.id} copyable />,
                  },
                  {
                    label: "Updated",
                    value: <DateDisplay value={order.updated_at} />,
                  },
                ]}
              />
            </DetailSection>
          </>
        }
      >
        <DetailSection title="Order Items">
          <OrderItems items={order.items} currency={order.currency} />
        </DetailSection>
        <DetailSection title="Order Status History">
          <Timeline
            label="Order state changes"
            emptyMessage="No status transitions recorded."
            entries={order.status_history.map((h) => ({
              id: h.id,
              title: `${h.from_status.replaceAll("_", " ")} → ${h.to_status.replaceAll("_", " ")}`,
              occurredAt: h.created_at,
              description: h.notes,
              actor: h.actor_id ? (
                <>
                  Actor <Identifier value={h.actor_id} />
                </>
              ) : undefined,
            }))}
          />
        </DetailSection>
        {(canReadShipments || canReadReturns) && (
          <RelatedOrderWork
            sellerId={sellerId}
            orderId={orderId}
            canReadShipments={canReadShipments}
            canReadReturns={canReadReturns}
          />
        )}
      </SplitLayout>

      {/* Ship Modal */}
      {shipModalOpen && (
        <Dialog
          open
          title={<>Fulfill & Ship Order</>}
          error={actionError}
          description={
            <>
              Ship {order.seller_order_number}. Shipment details notify the
              customer and consume reserved stock.
            </>
          }
          onClose={() => setShipModalOpen(false)}
          busy={actionLoading}
        >
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
                data-dialog-cancel
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
        </Dialog>
      )}

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <Dialog
          open
          title={<>Cancel Order</>}
          error={actionError}
          description={
            <>
              Cancel {order.seller_order_number}. This releases reserved stock
              and records the cancellation reason.
            </>
          }
          onClose={() => setCancelModalOpen(false)}
          busy={actionLoading}
        >
          <form onSubmit={onCancelSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="cancel-reason"
                className="mb-1 block text-sm font-medium text-ui-foreground"
              >
                Cancellation Reason *
              </label>
              <textarea
                id="cancel-reason"
                required
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
                data-dialog-cancel
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
        </Dialog>
      )}
    </div>
  );
}
