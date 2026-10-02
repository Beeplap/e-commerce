"use client";

import { useCallback, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Money, DateDisplay } from "@/components/ui/displays";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import { selectStyle } from "@/features/sellers/forms";
import {
  getSellerBalance,
  getSellerPayouts,
  requestPayout,
  type Payout,
  type SellerBalance,
} from "./api";

export function SellerPayouts() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead = access.permissions.includes("payouts.read");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return <PayoutsList key={access.id} sellerId={sellerId} />;
}

function PayoutsList({ sellerId }: { sellerId: string }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadBalance = useCallback(
    (signal: AbortSignal) => getSellerBalance(sellerId, signal),
    [sellerId],
  );
  const loadPayouts = useCallback(
    (signal: AbortSignal) =>
      getSellerPayouts(
        sellerId,
        {
          page,
          status: statusFilter || undefined,
        },
        signal,
      ),
    [sellerId, page, statusFilter],
  );

  const balanceQuery = useApiQuery(
    `${sellerId}:finance:payouts:balance`,
    loadBalance,
  );
  const payoutsQuery = useApiQuery(
    `${sellerId}:finance:payouts:${page}:${statusFilter}`,
    loadPayouts,
  );

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    setSubmitting(true);
    try {
      await requestPayout(sellerId, {
        amount: payoutAmount,
        notes: payoutNotes || undefined,
      });
      setShowModal(false);
      setPayoutAmount("");
      setPayoutNotes("");
      balanceQuery.retry();
      payoutsQuery.retry();
    } catch (err) {
      setPayoutError(
        err instanceof Error ? err.message : "Failed to request payout",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const balance: SellerBalance | undefined =
    balanceQuery.kind === "ready" ? balanceQuery.data : undefined;

  const columns: Column<Payout>[] = [
    {
      id: "payout_number",
      heading: "Payout Reference",
      cell: (payout) => (
        <div>
          <span className="font-mono text-sm font-semibold text-slate-900">
            {payout.payout_number}
          </span>
          {payout.notes && (
            <div className="mt-0.5 text-xs text-slate-500">{payout.notes}</div>
          )}
        </div>
      ),
    },
    {
      id: "amount",
      heading: "Amount",
      cell: (payout) => (
        <span className="font-semibold text-slate-900">
          <Money amount={payout.amount} currency={payout.currency} />
        </span>
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (payout) => (
        <div>
          <StatusBadge status={payout.status} />
          {payout.status === "REJECTED" && payout.rejection_reason && (
            <div className="mt-1 text-xs text-rose-600">
              Reason: {payout.rejection_reason}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "created_at",
      heading: "Requested At",
      cell: (payout) => <DateDisplay value={payout.created_at} />,
    },
    {
      id: "processed_at",
      heading: "Processed At",
      cell: (payout) =>
        payout.processed_at ? (
          <DateDisplay value={payout.processed_at} />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        description="View past disbursements and submit new payout requests against your available balance."
        actions={
          <button
            type="button"
            className={primaryButton}
            onClick={() => setShowModal(true)}
          >
            Request Payout
          </button>
        }
      />

      {/* Available Balance Reminder Card */}
      {balance && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Available for Payout
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              <Money
                amount={balance.current_balance}
                currency={balance.currency}
              />
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            Total Paid Out to Date:{" "}
            <span className="font-medium text-slate-700">
              <Money
                amount={balance.total_paid_out}
                currency={balance.currency}
              />
            </span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-48">
          <label htmlFor="payout-status-filter" className="sr-only">
            Filter by Status
          </label>
          <select
            id="payout-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={selectStyle}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PROCESSED">Processed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Payouts Table */}
      {payoutsQuery.kind === "loading" && <LoadingState />}
      {payoutsQuery.kind === "error" && (
        <ApiErrorState
          error={payoutsQuery.error}
          onRetry={payoutsQuery.retry}
        />
      )}
      {payoutsQuery.kind === "ready" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <DataTable
              rows={payoutsQuery.data.results}
              columns={columns}
              rowKey={(r) => r.id}
              caption="Payout history"
            />
          </div>

          <Pagination
            page={page}
            count={payoutsQuery.data.count}
            pageSize={25}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Request Payout Modal */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payout-req-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3
              id="payout-req-title"
              className="text-lg font-semibold text-slate-900"
            >
              Request Disbursement
            </h3>
            {balance && (
              <p className="mt-1 text-sm text-slate-600">
                Current available:{" "}
                <span className="font-semibold text-slate-900">
                  <Money
                    amount={balance.current_balance}
                    currency={balance.currency}
                  />
                </span>
              </p>
            )}

            {payoutError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {payoutError}
              </div>
            )}

            <form onSubmit={handleRequestPayout} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="req-amount"
                  className="block text-sm font-medium text-slate-700"
                >
                  Amount ({balance?.currency ?? "USD"})
                </label>
                <input
                  id="req-amount"
                  type="text"
                  required
                  placeholder="0.00"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="req-notes"
                  className="block text-sm font-medium text-slate-700"
                >
                  Disbursement Notes
                </label>
                <textarea
                  id="req-notes"
                  rows={2}
                  placeholder="Optional reference or banking memo"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  className={secondaryButton}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={primaryButton}
                >
                  {submitting ? "Submitting..." : "Submit Payout Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
