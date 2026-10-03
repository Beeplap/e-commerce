"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  secondaryButton,
} from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/form-fields";
import { FilterBar, FilterSummary } from "@/components/ui/filter-bar";
import { DateDisplay } from "@/components/ui/displays";
import { useTableQuery } from "@/components/ui/use-table-query";
import {
  inventoryApi,
  transactionTypes,
  type InventoryTransaction,
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
  const table = useTableQuery({ type: transactionTypes });
  const { page, setPage } = table;
  const typeFilter = table.values.type;

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
        description="Stock movements, reservations and returns."
        actions={
          <div className="flex gap-2">
            <Link href="/seller/inventory" className={secondaryButton}>
              Back to inventory
            </Link>
          </div>
        }
      />

      <div>
        <FilterBar>
          <SelectField
            label="Transaction type"
            value={typeFilter}
            onChange={(event) => table.setFilters({ type: event.target.value })}
          >
            <option value="">All transaction types</option>
            {transactionTypes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>
        </FilterBar>
        <FilterSummary
          filters={typeFilter ? [`Type: ${typeFilter}`] : []}
          onClear={table.clear}
        />
      </div>

      {(() => {
        const columns: Column<InventoryTransaction>[] = [
          {
            id: "timestamp",
            heading: "Date & Time",
            cell: (tx) => (
              <span className="text-xs text-ui-secondary">
                <DateDisplay value={tx.created_at} />
              </span>
            ),
          },
          {
            id: "type",
            heading: "Type",
            cell: (tx) => <StatusBadge status={tx.type} />,
          },
          {
            id: "delta",
            align: "right",
            heading: "Delta",
            cell: (tx) => (
              <span
                className={`font-mono text-xs font-bold ${
                  tx.quantity_delta > 0
                    ? "text-ui-success"
                    : tx.quantity_delta < 0
                      ? "text-ui-danger"
                      : "text-ui-secondary"
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
              <span className="text-xs font-medium text-ui-foreground">
                {tx.reason || "—"}
              </span>
            ),
          },
          {
            id: "reference",
            heading: "Reference",
            cell: (tx) => (
              <span className="text-xs font-mono text-ui-muted">
                {tx.reference_type && tx.reference_id
                  ? `${tx.reference_type}: ${tx.reference_id}`
                  : tx.reference_id || tx.reference_type || "—"}
              </span>
            ),
          },
        ];
        return (
          <DataTable
            mobile="scroll"
            filtered={!!typeFilter}
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
