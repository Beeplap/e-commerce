"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
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
  getAdminPayouts,
  approvePayout,
  processPayout,
  rejectPayout,
  type Payout,
} from "./api";

const inputStyle =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

export function AdminPayouts() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!hasPlatformPermission(user, "platform.finance.read")) {
    return <ForbiddenScreen />;
  }

  const canManage = hasPlatformPermission(user, "platform.finance.manage");

  return <PayoutsList canManage={canManage} />;
}

function PayoutsList({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sellerIdInput, setSellerIdInput] = useState<string>("");
  const [appliedSellerId, setAppliedSellerId] = useState<string>("");

  const [processingPayout, setProcessingPayout] = useState<Payout | null>(null);
  const [rejectingPayout, setRejectingPayout] = useState<Payout | null>(null);
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadPayouts = useCallback(
    (signal: AbortSignal) =>
      getAdminPayouts(
        {
          page,
          status: statusFilter || undefined,
          seller_id: appliedSellerId || undefined,
        },
        signal,
      ),
    [page, statusFilter, appliedSellerId],
  );

  const queryKey = `admin:finance:payouts:${page}:${statusFilter}:${appliedSellerId}`;
  const query = useApiQuery(queryKey, loadPayouts);

  const handleApprove = async (payout: Payout) => {
    setActionError(null);
    setApprovingId(payout.id);
    try {
      await approvePayout(payout.id);
      query.retry();
    } catch (err) {
      setActionError({
        id: payout.id,
        message:
          err instanceof Error ? err.message : "Failed to approve payout",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const columns: Column<Payout>[] = [
    {
      id: "payout_number",
      heading: "Payout #",
      cell: (item) => (
        <span className="font-semibold text-slate-900">
          {item.payout_number}
        </span>
      ),
    },
    {
      id: "seller",
      heading: "Seller",
      cell: (item) => (
        <span className="font-medium text-slate-800">{item.seller_name}</span>
      ),
    },
    {
      id: "amount",
      heading: "Amount",
      cell: (item) => (
        <span className="font-bold text-slate-900">
          <Money amount={item.amount} currency={item.currency} />
        </span>
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (item) => <StatusBadge status={item.status} />,
    },
    {
      id: "created_at",
      heading: "Requested",
      cell: (item) => <DateDisplay value={item.created_at} />,
    },
    {
      id: "details",
      heading: "Details",
      cell: (item) => (
        <div className="text-xs text-slate-600">
          {item.status === "REJECTED" && (
            <span className="text-rose-700">
              Reason: {item.rejection_reason}
            </span>
          )}
          {item.status === "PROCESSED" && item.processed_at && (
            <span>
              Processed: <DateDisplay value={item.processed_at} />
            </span>
          )}
          {item.notes && item.status !== "REJECTED" && (
            <span className="italic block truncate max-w-xs">{item.notes}</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      heading: "Actions",
      cell: (item) => {
        if (!canManage) {
          return <span className="text-xs text-slate-400">View only</span>;
        }

        const isApproving = approvingId === item.id;
        const hasError = actionError?.id === item.id;

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {item.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    disabled={isApproving}
                    onClick={() => handleApprove(item)}
                    className="rounded-lg bg-teal-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {isApproving ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingPayout(item)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Reject
                  </button>
                </>
              )}

              {item.status === "APPROVED" && (
                <>
                  <button
                    type="button"
                    onClick={() => setProcessingPayout(item)}
                    className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Process Disbursement
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingPayout(item)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Reject
                  </button>
                </>
              )}

              {(item.status === "PROCESSED" || item.status === "REJECTED") && (
                <span className="text-xs text-slate-400">Finalized</span>
              )}
            </div>

            {hasError && (
              <p
                role="alert"
                className="text-xs font-medium text-rose-700 max-w-xs"
              >
                {actionError.message}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/admin/finance"
          className="text-sm font-medium text-teal-800 hover:underline"
        >
          &larr; Back to Finance Overview
        </Link>
      </div>

      <PageHeader
        title="Seller Payouts Management"
        description="Review seller withdrawal requests, authorize disbursement approvals, and record completed settlement references."
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="w-48">
          <label htmlFor="payout-status-filter" className="sr-only">
            Filter by status
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
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved (Ready to Process)</option>
            <option value="PROCESSED">Processed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSellerId(sellerIdInput.trim());
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={sellerIdInput}
            onChange={(e) => setSellerIdInput(e.target.value)}
            placeholder="Filter by Seller UUID…"
            className={`w-64 ${inputStyle}`}
          />
          <button type="submit" className={secondaryButton}>
            Filter
          </button>
          {appliedSellerId && (
            <button
              type="button"
              onClick={() => {
                setSellerIdInput("");
                setAppliedSellerId("");
                setPage(1);
              }}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {query.kind === "loading" && <LoadingState />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}

      {query.kind === "ready" && (
        <div className="space-y-4">
          <DataTable
            rows={query.data.results}
            columns={columns}
            rowKey={(item) => item.id}
            caption="Seller Payouts"
          />

          {query.data.count > 25 && (
            <Pagination
              page={page}
              count={query.data.count}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </div>
      )}

      {/* Process Payout Modal */}
      {processingPayout && (
        <ProcessPayoutModal
          payout={processingPayout}
          onClose={() => setProcessingPayout(null)}
          onSuccess={() => {
            setProcessingPayout(null);
            query.retry();
          }}
        />
      )}

      {/* Reject Payout Modal */}
      {rejectingPayout && (
        <RejectPayoutModal
          payout={rejectingPayout}
          onClose={() => setRejectingPayout(null)}
          onSuccess={() => {
            setRejectingPayout(null);
            query.retry();
          }}
        />
      )}
    </div>
  );
}

function ProcessPayoutModal({
  payout,
  onClose,
  onSuccess,
}: {
  payout: Payout;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await processPayout(payout.id, {
        payout_reference: reference.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process payout");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="process-payout-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2
          id="process-payout-title"
          className="text-lg font-bold text-slate-900"
        >
          Process Payout Disbursement
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Disbursing{" "}
          <strong className="text-slate-900">
            {payout.amount} {payout.currency}
          </strong>{" "}
          to <strong className="text-slate-900">{payout.seller_name}</strong> (
          {payout.payout_number}).
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="payout-reference"
              className="block text-xs font-semibold text-slate-700"
            >
              Bank / ACH / Transfer Reference (Optional)
            </label>
            <p className="mb-1 text-xs text-slate-500">
              Transaction ID or bank trace number for reconciliation.
            </p>
            <input
              id="payout-reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TRF-2026-981726"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={primaryButton}
            >
              {submitting ? "Finalizing…" : "Confirm Processed"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RejectPayoutModal({
  payout,
  onClose,
  onSuccess,
}: {
  payout: Payout;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await rejectPayout(payout.id, { reason: reason.trim() });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject payout");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-payout-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2
          id="reject-payout-title"
          className="text-lg font-bold text-slate-900"
        >
          Reject Payout Request
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Rejecting{" "}
          <strong className="text-slate-900">
            {payout.amount} {payout.currency}
          </strong>{" "}
          for <strong className="text-slate-900">{payout.seller_name}</strong> (
          {payout.payout_number}).
        </p>
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
          The requested amount will automatically be restored back to the
          seller&apos;s available balance via a compensating ledger entry.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="reject-reason"
              className="block text-xs font-semibold text-slate-700"
            >
              Reason for Rejection *
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Invalid bank routing number or pending account verification"
              className={`mt-1 ${inputStyle}`}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className={secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
            >
              {submitting ? "Rejecting…" : "Reject Payout"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
