"use client";

import { Dialog } from "@/components/ui/dialog";
import { PayoutDetail } from "./payout-detail";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { FilterSummary } from "@/components/ui/filter-bar";
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

  return <PayoutsList key={user?.id} canManage={canManage} />;
}

function PayoutsList({ canManage }: { canManage: boolean }) {
  const table = useTableQuery({
    status: ["PENDING", "APPROVED", "PROCESSED", "REJECTED"],
    seller_id: 36,
  });
  const { page, setPage } = table;
  const statusFilter = table.values.status;
  const setStatusFilter = (status: string) => table.setFilters({ status });
  const appliedSellerId = table.values.seller_id;

  const [processingPayout, setProcessingPayout] = useState<Payout | null>(null);
  const [rejectingPayout, setRejectingPayout] = useState<Payout | null>(null);
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<Payout | null>(null);
  const approvalInFlight = useRef(false);

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
    if (approvalInFlight.current) return;
    approvalInFlight.current = true;
    setActionError(null);
    setApprovingId(payout.id);
    try {
      await approvePayout(payout.id);
      setApprovalTarget(null);
      query.retry();
    } catch (err) {
      setActionError({
        id: payout.id,
        message:
          err instanceof Error ? err.message : "Failed to approve payout",
      });
    } finally {
      approvalInFlight.current = false;
      setApprovingId(null);
    }
  };

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
      align: "right" as const,
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
                    onClick={() => {
                      setActionError(null);
                      setApprovalTarget(item);
                    }}
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

            {hasError && !approvalTarget && (
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

      {inspectingPayout && (
        <PayoutDetail
          payout={inspectingPayout}
          onClose={() => setInspectingPayout(null)}
        />
      )}
      <PageHeader
        title="Seller Payouts Management"
        description="Review seller withdrawal requests, authorize disbursement approvals, and record completed settlement references."
      />
      <ConfirmDialog
        open={approvalTarget !== null}
        title="Approve payout"
        description={
          approvalTarget
            ? `Approve ${approvalTarget.payout_number} for ${approvalTarget.seller_name}: ${approvalTarget.amount} ${approvalTarget.currency}. This authorizes the requested withdrawal for processing. It does not record a completed disbursement.`
            : ""
        }
        confirmLabel="Approve payout"
        busy={approvingId !== null}
        error={
          actionError?.id === approvalTarget?.id
            ? actionError?.message
            : undefined
        }
        onCancel={() => setApprovalTarget(null)}
        onConfirm={() => {
          if (approvalTarget) void handleApprove(approvalTarget);
        }}
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

        <SellerPayoutFilter
          key={appliedSellerId}
          value={appliedSellerId}
          onApply={(seller_id) => table.setFilters({ seller_id })}
        />
      </div>

      <FilterSummary
        filters={[
          ...(statusFilter ? [`Status: ${statusFilter.toLowerCase()}`] : []),
          ...(appliedSellerId ? [`Seller: ${appliedSellerId}`] : []),
        ]}
        onClear={table.clear}
      />
      {query.kind === "loading" && <LoadingState />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}

      {query.kind === "ready" && (
        <div className="space-y-4">
          <DataTable
            filtered={!!statusFilter || !!appliedSellerId}
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

function SellerPayoutFilter({
  value,
  onApply,
}: {
  value: string;
  onApply: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="flex max-w-full flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft.trim());
      }}
    >
      <label className="min-w-0 text-ui-caption text-ui-secondary">
        Seller ID
        <input
          type="text"
          value={draft}
          maxLength={36}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Filter by Seller UUID…"
          className={`mt-1 w-full sm:w-64 ${inputStyle}`}
        />
      </label>
      <button type="submit" className={secondaryButton}>
        Filter
      </button>
      {value && (
        <button
          type="button"
          className={secondaryButton}
          onClick={() => onApply("")}
        >
          Clear seller
        </button>
      )}
    </form>
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
    <Dialog
      open
      title={<>Process Payout Disbursement</>}
      description={
        <>
          Disbursing{" "}
          <strong className="text-slate-900">
            {payout.amount} {payout.currency}
          </strong>{" "}
          to <strong className="text-slate-900">{payout.seller_name}</strong> (
          {payout.payout_number}).
        </>
      }
      onClose={onClose}
      busy={submitting}
      error={error}
    >
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

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className={secondaryButton}
            data-dialog-cancel
          >
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={primaryButton}>
            {submitting ? "Finalizing…" : "Confirm Processed"}
          </button>
        </div>
      </form>
    </Dialog>
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
    <Dialog
      open
      title={<>Reject Payout Request</>}
      description={
        <>
          Rejecting{" "}
          <strong className="text-slate-900">
            {payout.amount} {payout.currency}
          </strong>{" "}
          for <strong className="text-slate-900">{payout.seller_name}</strong> (
          {payout.payout_number}).
        </>
      }
      onClose={onClose}
      busy={submitting}
      error={error}
    >
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

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className={secondaryButton}
            data-dialog-cancel
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
    </Dialog>
  );
}
