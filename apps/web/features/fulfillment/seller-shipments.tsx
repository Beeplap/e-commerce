"use client";

import { Timeline } from "@/components/ui/timeline";
import { DetailGrid } from "@/components/ui/detail-layout";
import { Dialog } from "@/components/ui/dialog";

import { useCallback, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DateDisplay } from "@/components/ui/displays";
import {
  ApiErrorState,
  FormField,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  sellerListShipments,
  sellerCreateShipment,
  sellerAddTrackingEvent,
  sellerDeliverShipment,
  type Shipment,
} from "./api";

export function SellerShipments() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead =
    access.permissions.includes("fulfillment.read") ||
    access.permissions.includes("orders.read");
  const canManage =
    access.permissions.includes("fulfillment.manage") ||
    access.permissions.includes("orders.update");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return (
    <ShipmentsContent
      key={access.id}
      sellerId={sellerId}
      canManage={canManage}
    />
  );
}

function ShipmentsContent({
  sellerId,
  canManage,
}: {
  sellerId: string;
  canManage: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(
    null,
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);

  // Form states for creating shipment
  const [orderId, setOrderId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for adding tracking event
  const [eventStatus, setEventStatus] = useState("in_transit");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");

  const loadShipments = useCallback(
    () => sellerListShipments(sellerId, { status: statusFilter || undefined }),
    [sellerId, statusFilter],
  );

  const query = useApiQuery(
    `${sellerId}:shipments:${statusFilter}`,
    loadShipments,
  );

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await sellerCreateShipment(sellerId, {
        seller_order_id: orderId.trim(),
        carrier: carrier.trim(),
        tracking_number: trackingNumber.trim(),
        items: [
          {
            order_item_id: orderItemId.trim(),
            quantity: parseInt(quantity, 10) || 1,
          },
        ],
      });
      setShowCreateModal(false);
      setOrderId("");
      setOrderItemId("");
      setCarrier("");
      setTrackingNumber("");
      query.retry();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create shipment",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await sellerAddTrackingEvent(sellerId, selectedShipment.id, {
        status: eventStatus,
        location: eventLocation.trim(),
        description: eventDescription.trim(),
      });
      setShowEventModal(false);
      setEventLocation("");
      setEventDescription("");
      query.retry();
      setSelectedShipment(null);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to add tracking event",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeliver = async (shipmentId: string) => {
    try {
      await sellerDeliverShipment(sellerId, shipmentId);
      query.retry();
      setSelectedShipment(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to mark delivered");
    }
  };

  if (query.kind === "loading") return <LoadingState variant="table" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const shipments = query.data.results;

  const columns: Column<Shipment>[] = [
    {
      id: "number",
      heading: "Shipment #",
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          {row.shipment_number}
        </span>
      ),
    },
    {
      id: "order",
      heading: "Order #",
      cell: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.seller_order_number}
        </span>
      ),
    },
    {
      id: "carrier",
      heading: "Carrier & Tracking",
      cell: (row) => (
        <div>
          <div className="font-medium text-slate-900">{row.carrier}</div>
          {row.tracking_number && (
            <div className="text-xs text-slate-500 font-mono">
              {row.tracking_number}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "items",
      align: "right" as const,
      heading: "Items",
      cell: (row) => (
        <span className="text-slate-600">
          {row.items.reduce((acc, it) => acc + it.quantity, 0)} units
        </span>
      ),
    },
    {
      id: "date",
      heading: "Created",
      cell: (row) => <DateDisplay value={row.created_at} />,
    },
    {
      id: "actions",
      heading: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedShipment(row)}
            className="text-xs font-medium text-teal-700 hover:text-teal-900"
          >
            Inspect
          </button>
          {canManage && row.status !== "delivered" && (
            <button
              type="button"
              onClick={() => handleDeliver(row.id)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Deliver
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        title="Shipments & Fulfillment"
        description="Track outbound packages, carrier events, and dispatch shipments for confirmed orders."
        actions={
          canManage && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className={primaryButton}
            >
              Create Shipment
            </button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <label htmlFor="shipment-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="shipment-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="shipped">Shipped</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      <DataTable
        caption="Seller Shipments"
        columns={columns}
        rows={shipments}
        rowKey={(row) => row.id}
      />

      {/* Create Shipment Modal */}
      {showCreateModal && (
        <Dialog
          open
          title={<>Create Outbound Shipment</>}
          description={
            <>Specify the order, carrier details, and order item to fulfill.</>
          }
          onClose={() => setShowCreateModal(false)}
          busy={submitting}
          size="wide"
          error={formError}
        >
          <form onSubmit={handleCreateShipment} className="mt-4 space-y-4">
            <FormField
              label="Seller Order ID"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="UUID of confirmed order"
              required
            />
            <FormField
              label="Order Item ID"
              value={orderItemId}
              onChange={(e) => setOrderItemId(e.target.value)}
              placeholder="UUID of order item"
              required
            />
            <FormField
              label="Quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <FormField
              label="Carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g. FedEx, UPS, DHL"
              required
            />
            <FormField
              label="Tracking Number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Optional carrier tracking code"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className={secondaryButton}
                data-dialog-cancel
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={primaryButton}
              >
                {submitting ? "Creating…" : "Dispatch Shipment"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Inspect Shipment Modal */}
      {selectedShipment && (
        <Dialog
          open
          title={<>{selectedShipment.shipment_number}</>}
          onClose={() => setSelectedShipment(null)}
          busy={submitting}
          size="wide"
        >
          <div className="flex items-center justify-between">
            <StatusBadge status={selectedShipment.status} />
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>
              Carrier:{" "}
              <span className="font-medium text-slate-900">
                {selectedShipment.carrier}
              </span>
            </div>
            {selectedShipment.tracking_number && (
              <div>
                Tracking:{" "}
                <span className="font-mono text-slate-900">
                  {selectedShipment.tracking_number}
                </span>
              </div>
            )}
            <div>
              Order:{" "}
              <span className="font-mono text-slate-900">
                {selectedShipment.seller_order_number}
              </span>
            </div>
          </div>

          <DetailGrid
            items={[
              {
                label: "Created",
                value: <DateDisplay value={selectedShipment.created_at} />,
              },
              {
                label: "Shipped",
                value: selectedShipment.shipped_at ? (
                  <DateDisplay value={selectedShipment.shipped_at} />
                ) : (
                  "Not shipped"
                ),
              },
              {
                label: "Expected delivery",
                value: selectedShipment.estimated_delivery_at ? (
                  <DateDisplay value={selectedShipment.estimated_delivery_at} />
                ) : (
                  "Not supplied"
                ),
              },
              {
                label: "Delivered",
                value: selectedShipment.delivered_at ? (
                  <DateDisplay value={selectedShipment.delivered_at} />
                ) : (
                  "Not delivered"
                ),
              },
            ]}
          />
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Shipment Items
            </h3>
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 p-3">
              {selectedShipment.items.map((item) => (
                <li key={item.id} className="py-2 flex justify-between text-sm">
                  <span>{item.product_name_snapshot || item.sku_snapshot}</span>
                  <span className="font-semibold text-slate-900">
                    x{item.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Tracking Timeline
              </h3>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowEventModal(true)}
                  className="text-xs font-medium text-teal-700 hover:text-teal-900"
                >
                  + Add Event
                </button>
              )}
            </div>
            <Timeline
              label="Shipment tracking events"
              entries={selectedShipment.tracking_events.map((event) => ({
                id: event.id,
                title: event.status.replaceAll("_", " "),
                occurredAt: event.timestamp,
                description: (
                  <>
                    {event.location && <p>{event.location}</p>}
                    {event.description}
                  </>
                ),
              }))}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setSelectedShipment(null)}
              className={secondaryButton}
              data-dialog-cancel
            >
              Close
            </button>
          </div>
        </Dialog>
      )}

      {/* Add Tracking Event Modal */}
      {showEventModal && selectedShipment && (
        <Dialog
          open
          title={<>Add Tracking Event</>}
          onClose={() => setShowEventModal(false)}
          busy={submitting}
          size="wide"
          error={formError}
        >
          <form onSubmit={handleAddEvent} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                value={eventStatus}
                onChange={(e) => setEventStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              >
                <option value="in_transit">In Transit</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
            <FormField
              label="Location"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              placeholder="e.g. Distribution Center"
            />
            <FormField
              label="Description"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="e.g. Package arrived at sort facility"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className={secondaryButton}
                data-dialog-cancel
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={primaryButton}
              >
                {submitting ? "Saving…" : "Save Event"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
