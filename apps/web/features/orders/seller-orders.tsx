"use client";

import Link from "next/link";
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
} from "@/components/ui/primitives";
import { selectStyle } from "@/features/sellers/forms";
import { listSellerOrders, type SellerOrderSummary } from "./api";

const searchInputStyle =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

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
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

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
            className="font-medium text-teal-800 hover:underline"
          >
            {item.seller_order_number}
          </Link>
          <div className="text-xs text-slate-500">
            Parent: {item.order_number}
          </div>
        </div>
      ),
    },
    {
      id: "items",
      heading: "Items",
      cell: (item) => (
        <span>
          {item.items_count} item{item.items_count === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      id: "total",
      heading: "Total",
      cell: (item) => <Money amount={item.subtotal} currency={item.currency} />,
    },
    {
      id: "net_amount",
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
          className="text-xs font-semibold text-teal-700 hover:text-teal-900"
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
        description="Manage customer orders, fulfill shipments, and track delivery status."
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(searchInput);
          }}
        >
          <input
            type="search"
            aria-label="Search orders"
            placeholder="Search by order number..."
            className={searchInputStyle}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className={primaryButton}>
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-sm font-medium text-slate-700 whitespace-nowrap"
          >
            Status:
          </label>
          <select
            id="status-filter"
            aria-label="Filter orders by status"
            className={selectStyle}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {query.kind === "loading" && <LoadingState label="Loading orders…" />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}

      {query.kind === "ready" && (
        <>
          <DataTable
            caption="Customer Orders"
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
    </div>
  );
}
