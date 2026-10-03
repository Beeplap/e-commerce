"use client";

import { QueryRegion } from "@/components/ui/query-region";

import { Dialog } from "@/components/ui/dialog";

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
  FormField,
  LoadingState,
  PageHeader,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import {
  getAdminSellerBalances,
  adjustSellerBalance,
  type AdminSellerBalance,
} from "./api";

const inputStyle =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

export function AdminSellerBalances() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!hasPlatformPermission(user, "platform.finance.read")) {
    return <ForbiddenScreen />;
  }

  const canManage = hasPlatformPermission(user, "platform.finance.manage");

  return <SellerBalancesList canManage={canManage} />;
}

function SellerBalancesList({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [adjustingSeller, setAdjustingSeller] =
    useState<AdminSellerBalance | null>(null);

  const loadBalances = useCallback(
    (signal: AbortSignal) =>
      getAdminSellerBalances(
        {
          page,
          search: appliedSearch || undefined,
        },
        signal,
      ),
    [page, appliedSearch],
  );

  const queryKey = `admin:finance:seller-balances:${page}:${appliedSearch}`;
  const query = useApiQuery(queryKey, loadBalances);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const columns: Column<AdminSellerBalance>[] = [
    {
      id: "seller",
      heading: "Seller",
      cell: (item) => (
        <div>
          <span className="font-semibold text-slate-900">
            {item.seller_name}
          </span>
          <span className="block text-xs text-slate-500">
            @{item.seller_slug}
          </span>
        </div>
      ),
    },
    {
      id: "current_balance",
      align: "right" as const,
      heading: "Available Balance",
      cell: (item) => (
        <span className="font-semibold text-emerald-700">
          <Money amount={item.current_balance} currency={item.currency} />
        </span>
      ),
    },
    {
      id: "pending_balance",
      align: "right" as const,
      heading: "Pending Escrow",
      cell: (item) => (
        <span className="text-slate-600">
          <Money amount={item.pending_balance} currency={item.currency} />
        </span>
      ),
    },
    {
      id: "total_paid_out",
      align: "right" as const,
      heading: "Total Paid Out",
      cell: (item) => (
        <span className="text-slate-900">
          <Money amount={item.total_paid_out} currency={item.currency} />
        </span>
      ),
    },
    {
      id: "updated_at",
      heading: "Last Activity",
      cell: (item) => <DateDisplay value={item.updated_at} />,
    },
    {
      id: "actions",
      heading: "Actions",
      cell: (item) =>
        canManage ? (
          <button
            type="button"
            onClick={() => setAdjustingSeller(item)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Adjust Balance
          </button>
        ) : (
          <span className="text-xs text-ui-muted">View only</span>
        ),
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
        title="Seller Balances"
        description="Inspect authoritatively tracked seller balances and post manual compensating adjustments with attributable audit descriptions."
      />

      {/* Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-0 flex-1 max-w-md">
          <FormField
            label="Search sellers"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by seller name or slug…"
          />
        </div>
        <button type="submit" className={secondaryButton}>
          Search
        </button>
        {appliedSearch && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setAppliedSearch("");
              setPage(1);
            }}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Clear
          </button>
        )}
      </form>

      <QueryRegion busy={query.kind === "loading"}>
        {query.kind === "loading" && (
          <LoadingState variant="table" label="Loading seller balances…" />
        )}
        {query.kind === "error" && (
          <ApiErrorState error={query.error} onRetry={query.retry} />
        )}

        {query.kind === "ready" && (
          <div className="space-y-4">
            <DataTable
              rows={query.data.results}
              columns={columns}
              rowKey={(item) => item.seller_id}
              caption="Seller Balances"
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
      </QueryRegion>

      {/* Balance Adjustment Modal */}
      {adjustingSeller && (
        <AdjustBalanceModal
          seller={adjustingSeller}
          onClose={() => setAdjustingSeller(null)}
          onSuccess={() => {
            setAdjustingSeller(null);
            query.retry();
          }}
        />
      )}
    </div>
  );
}

function AdjustBalanceModal({
  seller,
  onClose,
  onSuccess,
}: {
  seller: AdminSellerBalance;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adjustSellerBalance(seller.seller_id, {
        amount,
        description,
      });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to adjust seller balance",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      title={<>Adjust Seller Balance</>}
      description={
        <>
          Target:{" "}
          <strong className="text-slate-800">{seller.seller_name}</strong> (
          {seller.currency})
        </>
      }
      onClose={onClose}
      busy={submitting}
      error={error}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="adjust-amount"
            className="block text-xs font-semibold text-slate-700"
          >
            Adjustment Amount ({seller.currency}) *
          </label>
          <p className="mb-1 text-xs text-slate-500">
            Enter a positive amount to credit (e.g. 50.00) or negative to debit
            (e.g. -25.00).
          </p>
          <input
            id="adjust-amount"
            type="text"
            required
            pattern="^-?\d+(\.\d{1,2})?$"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 50.00 or -25.00"
            className={`mt-1 ${inputStyle}`}
          />
        </div>

        <div>
          <label
            htmlFor="adjust-description"
            className="block text-xs font-semibold text-slate-700"
          >
            Description *
          </label>
          <p className="mb-1 text-xs text-slate-500">
            State the reason for this compensating ledger entry for accounting
            records.
          </p>
          <textarea
            id="adjust-description"
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Manual credit for promotional fee refund"
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
            {submitting ? "Applying…" : "Apply Adjustment"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
