"use client";

import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";

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

type FulfillmentTab = "shipments" | "returns" | "refunds";

export function AdminFulfillmentOverview({
  initialTab = "shipments",
}: {
  initialTab?: FulfillmentTab;
}) {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead = hasPlatformPermission(user, "platform.fulfillment.read");
  const canRefund = hasPlatformPermission(user, "platform.refunds.manage");

  if (!user || !canRead) {
    return <ForbiddenScreen />;
  }

  return (
    <AdminFulfillmentDashboard
      key={`${user.id}:${initialTab}`}
      initialTab={initialTab}
      canRefund={Boolean(canRefund)}
    />
  );
}

function AdminFulfillmentDashboard({
  canRefund,
  initialTab,
}: {
  canRefund: boolean;
  initialTab: FulfillmentTab;
}) {
  const [activeTab, setActiveTab] = useState<FulfillmentTab>(initialTab);
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
        <span className="font-mono text-xs font-semibold text-ui-foreground">
          {row.shipment_number}
        </span>
      ),
    },
    {
      id: "seller",
      heading: "Seller",
      cell: (row) => (
        <span className="font-medium text-ui-foreground">
          {row.seller_name}
        </span>
      ),
    },
    {
      id: "order",
      heading: "Order #",
      cell: (row) => (
        <span className="font-mono text-xs text-ui-secondary">
          {row.seller_order_number}
        </span>
      ),
    },
    {
      id: "carrier",
      heading: "Carrier",
      cell: (row) => (
        <div>
          <div className="font-medium text-ui-foreground">{row.carrier}</div>
          <div className="font-mono text-xs text-ui-muted">
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
        <span className="font-mono text-xs font-semibold text-ui-foreground">
          {row.return_number}
        </span>
      ),
    },
    {
      id: "seller",
      heading: "Seller",
      cell: (row) => (
        <span className="font-medium text-ui-foreground">
          {row.seller_name}
        </span>
      ),
    },
    {
      id: "order",
      heading: "Order #",
      cell: (row) => (
        <span className="font-mono text-xs text-ui-secondary">
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
        <span className="font-mono text-xs font-semibold text-ui-foreground">
          {row.refund_number}
        </span>
      ),
    },
    {
      id: "seller",
      heading: "Seller",
      cell: (row) => (
        <span className="font-medium text-ui-foreground">
          {row.seller_name}
        </span>
      ),
    },
    {
      id: "order",
      heading: "Order #",
      cell: (row) => (
        <span className="font-mono text-xs text-ui-secondary">
          {row.seller_order_number}
        </span>
      ),
    },
    {
      id: "amount",
      align: "right" as const,
      heading: "Amount",
      cell: (row) => (
        <span className="font-semibold text-red-600">
          -<Money amount={row.amount} currency={row.currency} />
        </span>
      ),
    },
    {
      id: "commission",
      align: "right" as const,
      heading: "Comm. Reversal",
      cell: (row) => (
        <span className="text-ui-accent font-mono text-xs">
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
        description="Track shipments, returns and refunds."
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

      <Tabs
        label="Fulfillment views"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          {
            value: "shipments",
            label: "Shipments",
            content:
              shipmentsQuery.kind === "loading" ? (
                <LoadingState variant="table" />
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
                  rowKey={(row) => row.id}
                />
              ),
          },
          {
            value: "returns",
            label: "Returns",
            content:
              returnsQuery.kind === "loading" ? (
                <LoadingState variant="table" />
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
                  rowKey={(row) => row.id}
                />
              ),
          },
          {
            value: "refunds",
            label: "Refunds",
            content:
              refundsQuery.kind === "loading" ? (
                <LoadingState variant="table" />
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
                  rowKey={(row) => row.id}
                />
              ),
          },
        ]}
      />

      {/* Platform Refund Modal */}
      {showRefundModal && (
        <Dialog
          open
          title={<>Platform Customer Refund</>}
          description={
            <>
              Issue an administrative concession refund on an order. Commission
              reversal and seller ledger entries are calculated automatically.
            </>
          }
          onClose={() => setShowRefundModal(false)}
          busy={submitting}
          error={formError}
        >
          <form onSubmit={handleCreateRefund} className="mt-4 space-y-4">
            <FormField
              label="Seller Order ID"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="UUID of order to refund"
              required
            />
            <FormField
              label="Refund Amount (order currency)"
              hint="Enter the amount in the original order currency. Django validates the remaining refundable amount."
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
            <div className="rounded-control border border-ui-border bg-ui-surface-muted p-3 text-ui-body">
              <p className="font-medium">Review refund</p>
              <p className="mt-1 break-words">
                Seller order: {orderId || "Enter the order identifier above"}
              </p>
              <p>
                Amount: {amount || "Enter an amount above"} in the order
                currency
              </p>
              <p className="mt-2 text-ui-secondary">
                Confirming records a customer refund and adjusts the commission
                and seller ledger. Check the order, amount and reason before
                continuing.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className={secondaryButton}
                data-dialog-cancel
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
        </Dialog>
      )}
    </section>
  );
}
