"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { hasPlatformPermission } from "@/lib/permissions";
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
  adminListShipments,
  adminListReturns,
  adminListRefunds,
  adminCreateRefund,
  type Shipment,
  type ReturnRequest,
  type Refund,
} from "./api";

export function AdminFulfillmentOverview() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead = hasPlatformPermission(user, "platform.fulfillment.read");
  const canRefund = hasPlatformPermission(user, "platform.refunds.manage");

  if (!canRead) {
    return <ForbiddenScreen />;
  }

  return <AdminFulfillmentDashboard canRefund={Boolean(canRefund)} />;
}

function AdminFulfillmentDashboard({ canRefund }: { canRefund: boolean }) {
  const [activeTab, setActiveTab] = useState<
    "shipments" | "returns" | "refunds"
  >("shipments");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadShipments = useCallback(() => adminListShipments(), []);
  const loadReturns = useCallback(() => adminListReturns(), []);
  const loadRefunds = useCallback(() => adminListRefunds(), []);

  const shipmentsQuery = useApiQuery("admin:shipments", loadShipments);
  const returnsQuery = useApiQuery("admin:returns", loadReturns);
  const refundsQuery = useApiQuery("admin:refunds", loadRefunds);

  const handleCreateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await adminCreateRefund({
        seller_order_id: orderId.trim(),
        amount: amount.trim(),
        reason: reason.trim(),
      });
      setShowRefundModal(false);
      setOrderId("");
      setAmount("");
      setReason("");
      refundsQuery.retry();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to process platform refund",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const shipmentCols: Column<Shipment>[] = [
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
      id: "seller",
      heading: "Seller",
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.seller_name}</span>
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
      heading: "Carrier",
      cell: (row) => (
        <div>
          <div className="font-medium text-slate-900">{row.carrier}</div>
          <div className="font-mono text-xs text-slate-500">
            {row.tracking_number}
          </div>
        </div>
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "date",
      heading: "Date",
      cell: (row) => <DateDisplay value={row.created_at} />,
    },
  ];

  const returnCols: Column<ReturnRequest>[] = [
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
      id: "seller",
      heading: "Seller",
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.seller_name}</span>
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
        <span className="capitalize">{row.reason.replaceAll("_", " ")}</span>
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "date",
      heading: "Date",
      cell: (row) => <DateDisplay value={row.requested_at} />,
    },
  ];

  const refundCols: Column<Refund>[] = [
    {
      id: "number",
      heading: "Refund #",
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          {row.refund_number}
        </span>
      ),
    },
    {
      id: "seller",
      heading: "Seller",
      cell: (row) => (
        <span className="font-medium text-slate-900">{row.seller_name}</span>
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
      id: "amount",
      heading: "Amount",
      cell: (row) => (
        <span className="font-semibold text-red-600">
          -<Money amount={row.amount} currency={row.currency} />
        </span>
      ),
    },
    {
      id: "commission",
      heading: "Comm. Reversal",
      cell: (row) => (
        <span className="text-teal-700 font-mono text-xs">
          +<Money amount={row.commission_reversed} currency={row.currency} />
        </span>
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "date",
      heading: "Date",
      cell: (row) => <DateDisplay value={row.created_at} />,
    },
  ];

  return (
    <section>
      <PageHeader
        title="Marketplace Fulfillment & Logistics"
        description="Platform-wide logistics oversight, parcel carrier tracking, customer returns, and administrative refund resolution."
        actions={
          canRefund && (
            <button
              type="button"
              onClick={() => setShowRefundModal(true)}
              className={primaryButton}
            >
              Platform Refund
            </button>
          )
        }
      />

      <nav
        aria-label="Fulfillment navigation"
        className="mb-6 flex gap-2 border-b border-slate-200"
      >
        <button
          type="button"
          onClick={() => setActiveTab("shipments")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "shipments"
              ? "border-teal-700 text-teal-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Shipments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("returns")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "returns"
              ? "border-teal-700 text-teal-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Returns
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("refunds")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "refunds"
              ? "border-teal-700 text-teal-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Refunds
        </button>
      </nav>

      {activeTab === "shipments" &&
        (shipmentsQuery.kind === "loading" ? (
          <LoadingState />
        ) : shipmentsQuery.kind === "error" ? (
          <ApiErrorState
            error={shipmentsQuery.error}
            onRetry={shipmentsQuery.retry}
          />
        ) : (
          <DataTable
            caption="Marketplace Shipments"
            columns={shipmentCols}
            rows={shipmentsQuery.data.results}
            rowKey={(r) => r.id}
          />
        ))}

      {activeTab === "returns" &&
        (returnsQuery.kind === "loading" ? (
          <LoadingState />
        ) : returnsQuery.kind === "error" ? (
          <ApiErrorState
            error={returnsQuery.error}
            onRetry={returnsQuery.retry}
          />
        ) : (
          <DataTable
            caption="Marketplace Returns"
            columns={returnCols}
            rows={returnsQuery.data.results}
            rowKey={(r) => r.id}
          />
        ))}

      {activeTab === "refunds" &&
        (refundsQuery.kind === "loading" ? (
          <LoadingState />
        ) : refundsQuery.kind === "error" ? (
          <ApiErrorState
            error={refundsQuery.error}
            onRetry={refundsQuery.retry}
          />
        ) : (
          <DataTable
            caption="Marketplace Refunds"
            columns={refundCols}
            rows={refundsQuery.data.results}
            rowKey={(r) => r.id}
          />
        ))}

      {/* Platform Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-950">
              Platform Customer Refund
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Issue an administrative concession refund on an order. Commission
              reversal and seller ledger entries are calculated automatically.
            </p>
            {formError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateRefund} className="mt-4 space-y-4">
              <FormField
                label="Seller Order ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="UUID of order to refund"
                required
              />
              <FormField
                label="Refund Amount (USD)"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
              <FormField
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Administrative customer concession"
                required
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  {submitting ? "Processing…" : "Confirm Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
