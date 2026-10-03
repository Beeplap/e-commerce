"use client";

import { QueryRegion } from "@/components/ui/query-region";

import Link from "next/link";
import { useCallback } from "react";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Identifier } from "@/components/ui/identifier";
import { Money, DateDisplay } from "@/components/ui/displays";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  FilterBar,
  FilterSummary,
  SearchInput,
} from "@/components/ui/filter-bar";
import { SelectField } from "@/components/ui/form-fields";
import {
  useTableQuery,
  useDebouncedValue,
} from "@/components/ui/use-table-query";
import { listSellerOrders, type SellerOrderSummary } from "./api";

export function SellerOrders() {
  const access = useSeller();
  const sellerId = access.seller.id;
  const canRead = access.permissions.includes("orders.read");

  if (!canRead || access.seller.status !== "active") {
    return <ForbiddenScreen />;
  }

  return <SellerOrdersList key={access.id} sellerId={sellerId} />;
}

function SellerOrdersList({ sellerId }: { sellerId: string }) {
  const statuses = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];
  const table = useTableQuery({ search: 100, status: statuses });
  const { page, setPage } = table;
  const statusFilter = table.values.status;
  const appliedSearch = useDebouncedValue(table.values.search);
  const activeFilters = [
    table.values.search ? `Search: ${table.values.search}` : "",
    statusFilter ? `Status: ${statusFilter}` : "",
  ].filter(Boolean);

  const load = useCallback(
    (signal: AbortSignal) =>
      listSellerOrders(
        sellerId,
        {
          page,
          status: statusFilter || undefined,
          search: appliedSearch || undefined,
        },
        signal,
      ),
    [sellerId, page, statusFilter, appliedSearch],
  );

  const queryKey = `${sellerId}:orders:${page}:${statusFilter}:${appliedSearch}`;
  const query = useApiQuery(queryKey, load);

  const columns: Column<SellerOrderSummary>[] = [
    {
      id: "order_number",
      heading: "Order Number",
      cell: (item) => (
        <div>
          <Link
            href={`/seller/orders/${item.id}`}
            className="font-medium text-ui-accent hover:underline"
          >
            {item.seller_order_number}
          </Link>
          <div className="text-ui-caption text-ui-secondary">
            <Identifier
              value={item.order_number}
              label="parent order number"
              prefix="Parent: "
              copyable
            />
          </div>
        </div>
      ),
    },
    {
      id: "items",
      align: "right" as const,
      heading: "Items",
      cell: (item) => (
        <span>
          {item.items_count} item{item.items_count === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      id: "total",
      align: "right" as const,
      heading: "Total",
      cell: (item) => <Money amount={item.subtotal} currency={item.currency} />,
    },
    {
      id: "net_amount",
      align: "right" as const,
      heading: "Net Amount",
      cell: (item) => (
        <Money amount={item.seller_net_total} currency={item.currency} />
      ),
    },
    {
      id: "status",
      heading: "Status",
      cell: (item) => <StatusBadge status={item.status} />,
    },
    {
      id: "placed_at",
      heading: "Placed At",
      cell: (item) => <DateDisplay value={item.created_at} />,
    },
    {
      id: "actions",
      heading: "Actions",
      cell: (item) => (
        <Link
          href={`/seller/orders/${item.id}`}
          className="text-xs font-semibold text-ui-accent hover:text-ui-accent"
        >
          View Details &rarr;
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Review and fulfill customer orders."
      />

      {/* Filter and Search Bar */}
      <div>
        <FilterBar>
          <SearchInput
            label="Search orders"
            value={table.values.search}
            onChange={(value) => table.setFilters({ search: value }, true)}
          />
          <SelectField
            label="Status"
            aria-label="Filter orders by status"
            value={statusFilter}
            onChange={(event) =>
              table.setFilters({ status: event.target.value })
            }
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>
        </FilterBar>
        <FilterSummary filters={activeFilters} onClear={table.clear} />
      </div>

      <QueryRegion busy={query.kind === "loading"}>
        {query.kind === "loading" && (
          <LoadingState variant="table" label="Loading orders…" />
        )}
        {query.kind === "error" && (
          <ApiErrorState error={query.error} onRetry={query.retry} />
        )}

        {query.kind === "ready" && (
          <>
            <DataTable
              caption="Customer Orders"
              filtered={activeFilters.length > 0}
              columns={columns}
              rows={query.data.results}
              rowKey={(item) => item.id}
            />
            <Pagination
              page={page}
              count={query.data.count}
              pageSize={25}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryRegion>
    </div>
  );
}
