"use client";

import { useCallback, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DateDisplay, Money } from "@/components/ui/displays";
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
  sellerListReturns,
  sellerApproveReturn,
  sellerRejectReturn,
  sellerReceiveReturn,
  type ReturnRequest,
} from "./api";

export function SellerReturns() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead =
    access.permissions.includes("returns.read") ||
    access.permissions.includes("orders.read");
  const canManage =
    access.permissions.includes("returns.manage") ||
    access.permissions.includes("orders.update");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return (
    <ReturnsContent key={access.id} sellerId={sellerId} canManage={canManage} />
  );
}

function ReturnsContent({
  sellerId,
  canManage,
}: {
  sellerId: string;
  canManage: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(
    null,
  );
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [restockCondition, setRestockCondition] = useState("unopened");
  const [restockInventory, setRestockInventory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadReturns = useCallback(
    () => sellerListReturns(sellerId, { status: statusFilter || undefined }),
    [sellerId, statusFilter],
  );

  const query = useApiQuery(`${sellerId}:returns:${statusFilter}`, loadReturns);

  const handleApprove = async (returnId: string) => {
    setActionError(null);
    setSubmitting(true);
    try {
      await sellerApproveReturn(sellerId, returnId);
      query.retry();
      setSelectedReturn(null);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to approve return",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setActionError(null);
    setSubmitting(true);
    try {
      await sellerRejectReturn(sellerId, selectedReturn.id, {
        reason: rejectReason.trim(),
      });
      setShowRejectModal(false);
      setRejectReason("");
      query.retry();
      setSelectedReturn(null);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to reject return",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setActionError(null);
    setSubmitting(true);
    try {
      const items = selectedReturn.items.map((it) => ({
        return_item_id: it.id,
        condition: restockCondition,
        restock_inventory: restockInventory,
      }));
      await sellerReceiveReturn(sellerId, selectedReturn.id, { items });
      setShowReceiveModal(false);
      query.retry();
      setSelectedReturn(null);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to receive return",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (query.kind === "loading") return <LoadingState />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const returns = query.data.results;

  const columns: Column<ReturnRequest>[] = [
    {
      id: "number",
      heading: "Return #",
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          {row.return_number}
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
      id: "reason",
      heading: "Reason",
      cell: (row) => (
        <div>
          <div className="font-medium text-slate-900 capitalize">
            {row.reason.replaceAll("_", " ")}
          </div>
          {row.customer_notes && (
            <div className="text-xs text-slate-500 line-clamp-1">
              {row.customer_notes}
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
      heading: "Requested",
      cell: (row) => <DateDisplay value={row.requested_at} />,
    },
    {
      id: "actions",
      heading: "Actions",
      cell: (row) => (
        <button
          type="button"
          onClick={() => setSelectedReturn(row)}
          className="text-xs font-medium text-teal-700 hover:text-teal-900"
        >
          Inspect & Process
        </button>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        title="Returns & RMA Management"
        description="Inspect customer return requests, approve authorizations, and inspect returned stock for warehouse restocking."
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <label htmlFor="returns-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="returns-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
          >
            <option value="">All statuses</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="in_transit">In Transit</option>
            <option value="received">Received</option>
            <option value="refund_pending">Refund Pending</option>
            <option value="refunded">Refunded</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <DataTable
        caption="Customer Return Requests"
        columns={columns}
        rows={returns}
        rowKey={(row) => row.id}
      />

      {/* Inspect Return Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-950 font-mono">
                {selectedReturn.return_number}
              </h2>
              <StatusBadge status={selectedReturn.status} />
            </div>

            {actionError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div>
                Order:{" "}
                <span className="font-mono text-slate-900">
                  {selectedReturn.seller_order_number}
                </span>
              </div>
              <div>
                Reason:{" "}
                <span className="font-medium text-slate-900 capitalize">
                  {selectedReturn.reason.replaceAll("_", " ")}
                </span>
              </div>
              {selectedReturn.customer_notes && (
                <div>
                  Customer notes:{" "}
                  <span className="italic text-slate-800">
                    {selectedReturn.customer_notes}
                  </span>
                </div>
              )}
              {selectedReturn.rejection_reason && (
                <div className="text-red-700 font-medium">
                  Rejection reason: {selectedReturn.rejection_reason}
                </div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Returned Items
              </h3>
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 p-3">
                {selectedReturn.items.map((item) => (
                  <li
                    key={item.id}
                    className="py-2 flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {item.product_name_snapshot || item.sku_snapshot}
                      </div>
                      <div className="text-xs text-slate-500">
                        Condition: {item.condition} | Restock:{" "}
                        {item.restock_inventory ? "Yes" : "No"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        x{item.quantity}
                      </div>
                      <div className="text-xs text-slate-600 font-mono">
                        <Money amount={item.refund_amount} currency="USD" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Status History
              </h3>
              <ul className="mt-2 space-y-2">
                {selectedReturn.status_history.map((hist) => (
                  <li
                    key={hist.id}
                    className="rounded-lg bg-slate-50 p-2 text-xs"
                  >
                    <div className="flex justify-between font-medium text-slate-900">
                      <span>{hist.to_status}</span>
                      <span className="text-slate-500 font-normal">
                        <DateDisplay value={hist.created_at} />
                      </span>
                    </div>
                    {hist.notes && (
                      <div className="text-slate-600 mt-0.5">{hist.notes}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className={secondaryButton}
              >
                Close
              </button>

              {canManage && selectedReturn.status === "requested" && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Reject Return
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleApprove(selectedReturn.id)}
                    className={primaryButton}
                  >
                    {submitting ? "Approving…" : "Approve Return"}
                  </button>
                </>
              )}

              {canManage &&
                (selectedReturn.status === "approved" ||
                  selectedReturn.status === "in_transit") && (
                  <button
                    type="button"
                    onClick={() => setShowReceiveModal(true)}
                    className={primaryButton}
                  >
                    Receive & Restock
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">
              Reject Return Request
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Provide an explicit rejection reason for the customer.
            </p>
            <form onSubmit={handleReject} className="mt-4 space-y-3">
              <FormField
                label="Rejection Reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Return window expired, item unsealed"
                required
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  {submitting ? "Rejecting…" : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">
              Receive & Inspect Package
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Verify item condition and decide whether to restock into
              inventory.
            </p>
            <form onSubmit={handleReceive} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Item Condition
                </label>
                <select
                  value={restockCondition}
                  onChange={(e) => setRestockCondition(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                >
                  <option value="unopened">Unopened / Like New</option>
                  <option value="opened">Opened / Inspected</option>
                  <option value="damaged">Damaged (Not Restockable)</option>
                  <option value="defective">Defective</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="restock-checkbox"
                  type="checkbox"
                  checked={restockInventory}
                  onChange={(e) => setRestockInventory(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600"
                />
                <label
                  htmlFor="restock-checkbox"
                  className="text-xs text-slate-700 font-medium"
                >
                  Restock returned items to warehouse inventory
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={primaryButton}
                >
                  {submitting ? "Processing…" : "Confirm Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
