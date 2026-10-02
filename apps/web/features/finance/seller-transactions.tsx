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
} from "@/components/ui/primitives";
import { selectStyle } from "@/features/sellers/forms";
import { getSellerLedger, type SellerLedgerEntry } from "./api";

export function SellerTransactions() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead = access.permissions.includes("finance.read");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return <TransactionsList key={access.id} sellerId={sellerId} />;
}

function TransactionsList({ sellerId }: { sellerId: string }) {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");

  const load = useCallback(
    (signal: AbortSignal) =>
      getSellerLedger(
        sellerId,
        {
          page,
          entry_type: typeFilter || undefined,
        },
        signal,
      ),
    [sellerId, page, typeFilter],
  );

  const queryKey = `${sellerId}:finance:transactions:${page}:${typeFilter}`;
  const query = useApiQuery(queryKey, load);

  const columns: Column<SellerLedgerEntry>[] = [
    {
      id: "type",
      heading: "Transaction Type",
      cell: (entry) => <StatusBadge status={entry.entry_type} />,
    },
    {
      id: "amount",
      heading: "Amount",
      cell: (entry) => {
        const isNegative = entry.amount.startsWith("-");
        return (
          <span
            className={
              isNegative
                ? "font-medium text-rose-700"
                : "font-medium text-emerald-700"
            }
          >
            {isNegative ? "" : "+"}
            <Money amount={entry.amount} currency={entry.currency} />
          </span>
        );
      },
    },
    {
      id: "balance_after",
      heading: "Balance After",
      cell: (entry) => (
        <span className="font-mono text-sm">
          <Money amount={entry.balance_after} currency={entry.currency} />
        </span>
      ),
    },
    {
      id: "reference",
      heading: "Reference",
      cell: (entry) => (
        <div className="text-xs">
          {entry.seller_order_number && (
            <div className="font-medium text-slate-700">
              Order: {entry.seller_order_number}
            </div>
          )}
          {entry.payout_number && (
            <div className="font-medium text-slate-700">
              Payout: {entry.payout_number}
            </div>
          )}
          {entry.payment_reference && (
            <div className="text-slate-500">Ref: {entry.payment_reference}</div>
          )}
          {!entry.seller_order_number &&
            !entry.payout_number &&
            !entry.payment_reference && (
              <span className="text-slate-400">—</span>
            )}
        </div>
      ),
    },
    {
      id: "description",
      heading: "Description",
      cell: (entry) => (
        <span className="text-sm text-slate-800">{entry.description}</span>
      ),
    },
    {
      id: "date",
      heading: "Timestamp",
      cell: (entry) => (
        <span className="text-xs text-slate-500">
          <DateDisplay value={entry.created_at} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Ledger"
        description="Immutable record of all sales settlements, marketplace commissions, payouts, and adjustments."
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-48">
          <label htmlFor="tx-type-filter" className="sr-only">
            Filter by Type
          </label>
          <select
            id="tx-type-filter"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className={selectStyle}
          >
            <option value="">All Types</option>
            <option value="SALE">Sale Settlements</option>
            <option value="COMMISSION">Commissions</option>
            <option value="REFUND">Refunds</option>
            <option value="PAYOUT">Payouts</option>
            <option value="ADJUSTMENT">Adjustments</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {query.kind === "loading" && <LoadingState />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <DataTable
              rows={query.data.results}
              columns={columns}
              rowKey={(r) => r.id}
              caption="Financial ledger entries"
            />
          </div>

          <Pagination
            page={page}
            count={query.data.count}
            pageSize={25}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
