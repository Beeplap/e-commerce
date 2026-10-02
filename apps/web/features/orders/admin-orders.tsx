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
} from "@/components/ui/primitives";
import { selectStyle } from "@/features/sellers/forms";
import { listPlatformOrders, type PlatformOrderSummary } from "./api";

const searchInputStyle =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

export function AdminOrders() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!hasPlatformPermission(user, "platform.orders.read")) {
    return <ForbiddenScreen />;
  }

  return <AdminOrdersList />;
}

function AdminOrdersList() {
  const [page, setPage] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const load = useCallback(
    (signal: AbortSignal) =>
      listPlatformOrders(
        {
          page,
          payment_status: paymentStatus || undefined,
          fulfillment_status: fulfillmentStatus || undefined,
          search: appliedSearch || undefined,
        },
        signal,
      ),
    [page, paymentStatus, fulfillmentStatus, appliedSearch],
  );

  const queryKey = `admin:orders:${page}:${paymentStatus}:${fulfillmentStatus}:${appliedSearch}`;
  const query = useApiQuery(queryKey, load);

  const columns: Column<PlatformOrderSummary>[] = [
    {
      id: "order_number",
      heading: "Order Number",
      cell: (item) => (
        <Link
          href={`/admin/orders/${item.id}`}
          className="font-medium text-teal-800 hover:underline"
        >
          {item.order_number}
        </Link>
      ),
    },
    {
      id: "customer",
      heading: "Customer",
      cell: (item) => <span>{item.customer_email}</span>,
    },
    {
      id: "grand_total",
      heading: "Grand Total",
      cell: (item) => (
        <Money amount={item.grand_total} currency={item.currency} />
      ),
    },
    {
      id: "payment",
      heading: "Payment",
      cell: (item) => <StatusBadge status={item.payment_status} />,
    },
    {
      id: "fulfillment",
      heading: "Fulfillment",
      cell: (item) => <StatusBadge status={item.fulfillment_status} />,
    },
    {
      id: "sellers",
      heading: "Sellers",
      cell: (item) => (
        <span>
          {item.seller_orders_count} seller
          {item.seller_orders_count === 1 ? "" : "s"}
        </span>
      ),
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
          href={`/admin/orders/${item.id}`}
          className="text-xs font-semibold text-teal-700 hover:text-teal-900"
        >
          Inspect &rarr;
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Orders"
        description="Monitor marketplace orders across all sellers, inspection of fulfillment, and customer inquiries."
      />

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
            placeholder="Search by order number or customer email..."
            className={searchInputStyle}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className={primaryButton}>
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="payment-filter"
              className="text-sm font-medium text-slate-700 whitespace-nowrap"
            >
              Payment:
            </label>
            <select
              id="payment-filter"
              aria-label="Filter orders by payment status"
              className={selectStyle}
              value={paymentStatus}
              onChange={(e) => {
                setPage(1);
                setPaymentStatus(e.target.value);
              }}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="authorized">Authorized</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="fulfillment-filter"
              className="text-sm font-medium text-slate-700 whitespace-nowrap"
            >
              Fulfillment:
            </label>
            <select
              id="fulfillment-filter"
              aria-label="Filter orders by fulfillment status"
              className={selectStyle}
              value={fulfillmentStatus}
              onChange={(e) => {
                setPage(1);
                setFulfillmentStatus(e.target.value);
              }}
            >
              <option value="">All</option>
              <option value="unfulfilled">Unfulfilled</option>
              <option value="partially_fulfilled">Partially Fulfilled</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {query.kind === "loading" && <LoadingState label="Loading orders…" />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}

      {query.kind === "ready" && (
        <>
          <DataTable
            caption="Platform Orders"
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
