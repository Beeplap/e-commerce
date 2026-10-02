"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  secondaryButton,
} from "@/components/ui/primitives";
import { selectStyle } from "@/features/sellers/forms";
import {
  inventoryApi,
  transactionTypes,
  type InventoryTransaction,
  type TransactionType,
} from "./api";

export function SellerInventoryAdjustments() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead = access.permissions.includes("inventory.read");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return <AdjustmentsList key={access.id} sellerId={sellerId} />;
}

function AdjustmentsList({ sellerId }: { sellerId: string }) {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");

  const load = useCallback(
    (signal: AbortSignal) =>
      inventoryApi.transactions(
        sellerId,
        {
          page,
          type: typeFilter || undefined,
        },
        signal,
      ),
    [sellerId, page, typeFilter],
  );

  const query = useApiQuery(
    `${sellerId}:transactions:${page}:${typeFilter}`,
    load,
  );

  if (query.kind === "loading")
    return <LoadingState label="Loading transaction audit ledger…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const transactions = query.data.results;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Audit Ledger"
        description="Immutable record of all stock adjustments, reservations, shipments, and returns."
        actions={
          <div className="flex gap-2">
            <Link href="/seller/inventory" className={secondaryButton}>
              Back to inventory
            </Link>
          </div>
        }
      />

      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label
            htmlFor="transaction-type-filter"
            className="mb-1 block text-xs font-semibold text-slate-700"
          >
            Transaction type
          </label>
          <select
            id="transaction-type-filter"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className={`${selectStyle} min-w-[200px]`}
          >
            <option value="">All transaction types</option>
            {transactionTypes.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(() => {
        const columns: Column<InventoryTransaction>[] = [
          {
            id: "timestamp",
            heading: "Date & Time",
            cell: (tx) => (
              <span className="text-xs text-slate-600">
                {new Date(tx.created_at).toLocaleString()}
              </span>
            ),
          },
          {
            id: "type",
            heading: "Type",
            cell: (tx) => {
              const colors: Record<TransactionType, string> = {
                purchase: "bg-emerald-100 text-emerald-900",
                sale: "bg-blue-100 text-blue-900",
                return: "bg-purple-100 text-purple-900",
                adjustment: "bg-amber-100 text-amber-900",
                reservation: "bg-indigo-100 text-indigo-900",
                release: "bg-slate-100 text-slate-900",
              };
              return (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${colors[tx.type] ?? "bg-slate-100 text-slate-800"}`}
                >
                  {tx.type}
                </span>
              );
            },
          },
          {
            id: "delta",
            heading: "Delta",
            cell: (tx) => (
              <span
                className={`font-mono text-xs font-bold ${
                  tx.quantity_delta > 0
                    ? "text-emerald-700"
                    : tx.quantity_delta < 0
                      ? "text-rose-700"
                      : "text-slate-700"
                }`}
              >
                {tx.quantity_delta > 0
                  ? `+${tx.quantity_delta}`
                  : tx.quantity_delta}
              </span>
            ),
          },
          {
            id: "reason",
            heading: "Reason",
            cell: (tx) => (
              <span className="text-xs font-medium text-slate-900">
                {tx.reason || "—"}
              </span>
            ),
          },
          {
            id: "reference",
            heading: "Reference",
            cell: (tx) => (
              <span className="text-xs font-mono text-slate-500">
                {tx.reference_type && tx.reference_id
                  ? `${tx.reference_type}: ${tx.reference_id}`
                  : tx.reference_id || tx.reference_type || "—"}
              </span>
            ),
          },
        ];
        return (
          <DataTable
            caption="Inventory transactions"
            rows={transactions}
            rowKey={(tx) => tx.id}
            columns={columns}
          />
        );
      })()}

      {query.data.count > 25 && (
        <Pagination
          page={page}
          count={query.data.count}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
