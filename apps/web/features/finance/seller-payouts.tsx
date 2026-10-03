"use client";

import { Dialog } from "@/components/ui/dialog";
import { PayoutDetail } from "./payout-detail";
import { Button } from "@/components/ui/button";

import { useCallback, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar, FilterSummary } from "@/components/ui/filter-bar";
import { SelectField } from "@/components/ui/form-fields";
import { useTableQuery } from "@/components/ui/use-table-query";
import { Money, DateDisplay } from "@/components/ui/displays";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
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
  const table = useTableQuery({
    status: ["PENDING", "APPROVED", "PROCESSED", "REJECTED"],
  });
  const { page, setPage } = table;
  const statusFilter = table.values.status;
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

  const [inspectingPayout, setInspectingPayout] = useState<Payout | null>(null);

  const columns: Column<Payout>[] = [
    {
      id: "inspect",
      heading: "Inspect",
      cell: (item) => (
        <Button variant="quiet" onClick={() => setInspectingPayout(item)}>
          View details
        </Button>
      ),
    },
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
      align: "right" as const,
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
      {inspectingPayout && (
        <PayoutDetail
          payout={inspectingPayout}
          onClose={() => setInspectingPayout(null)}
        />
      )}
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

      <div>
        <FilterBar>
          <SelectField
            label="Filter by Status"
            value={statusFilter}
            onChange={(event) =>
              table.setFilters({ status: event.target.value })
            }
          >
            <option value="">All statuses</option>
            {["PENDING", "APPROVED", "PROCESSED", "REJECTED"].map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </SelectField>
        </FilterBar>
        <FilterSummary
          filters={
            statusFilter ? [`Status: ${statusFilter.toLowerCase()}`] : []
          }
          onClear={table.clear}
        />
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
              filtered={!!statusFilter}
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
        <Dialog
          open
          title={<>Request Disbursement</>}
          onClose={() => setShowModal(false)}
          busy={submitting}
          error={payoutError}
        >
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
                data-dialog-cancel
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
        </Dialog>
      )}
    </div>
  );
}
