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
import { sellerListRefunds, sellerCreateRefund, type Refund } from "./api";

export function SellerRefunds() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead =
    access.permissions.includes("returns.read") ||
    access.permissions.includes("finance.read") ||
    access.permissions.includes("orders.read");
  const canManage =
    access.permissions.includes("returns.manage") ||
    access.permissions.includes("orders.update");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return (
    <RefundsContent key={access.id} sellerId={sellerId} canManage={canManage} />
  );
}

function RefundsContent({
  sellerId,
  canManage,
}: {
  sellerId: string;
  canManage: boolean;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [returnId, setReturnId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRefunds = useCallback(
    () => sellerListRefunds(sellerId),
    [sellerId],
  );

  const query = useApiQuery(`${sellerId}:refunds`, loadRefunds);

  const handleCreateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await sellerCreateRefund(sellerId, {
        seller_order_id: orderId.trim(),
        amount: amount.trim(),
        reason: reason.trim(),
        return_request_id: returnId.trim() || undefined,
      });
      setShowCreateModal(false);
      setOrderId("");
      setAmount("");
      setReason("");
      setReturnId("");
      query.retry();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to process refund",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (query.kind === "loading") return <LoadingState />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const refunds = query.data.results;

  const columns: Column<Refund>[] = [
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
      heading: "Refund Amount",
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
      id: "net",
      heading: "Net Deduction",
      cell: (row) => (
        <span className="font-medium text-slate-900 font-mono text-xs">
          -<Money amount={row.seller_deduction} currency={row.currency} />
        </span>
      ),
    },
    {
      id: "reason",
      heading: "Reason",
      cell: (row) => (
        <span className="text-slate-600 text-xs">{row.reason}</span>
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "date",
      heading: "Processed",
      cell: (row) => <DateDisplay value={row.created_at} />,
    },
  ];

  return (
    <section>
      <PageHeader
        title="Refunds & Financial Adjustments"
        description="Review customer refunds, automatic marketplace commission reversals, and net ledger adjustments."
        actions={
          canManage && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className={primaryButton}
            >
              Issue Refund
            </button>
          )
        }
      />

      <DataTable
        caption="Seller Refunds"
        columns={columns}
        rows={refunds}
        rowKey={(row) => row.id}
      />

      {/* Create Refund Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-950">
              Issue Order Refund
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Process a customer refund with automatic proportional commission
              reversal and compensating ledger entries.
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
                placeholder="e.g. Return received, defective item concession"
                required
              />
              <FormField
                label="Return Request ID (Optional)"
                value={returnId}
                onChange={(e) => setReturnId(e.target.value)}
                placeholder="UUID of return request if applicable"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
