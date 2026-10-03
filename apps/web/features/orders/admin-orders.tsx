"use client";

import Link from "next/link";
import { useCallback } from "react";
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
import { listPlatformOrders, type PlatformOrderSummary } from "./api";

export function AdminOrders() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!hasPlatformPermission(user, "platform.orders.read")) {
    return <ForbiddenScreen />;
  }

  return <AdminOrdersList key={user?.id} />;
}

function AdminOrdersList() {
  const payments = ["pending", "authorized", "paid", "failed", "refunded"];
  const fulfillments = [
    "unfulfilled",
    "partially_fulfilled",
    "fulfilled",
    "cancelled",
  ];
  const table = useTableQuery({
    search: 100,
    payment_status: payments,
    fulfillment_status: fulfillments,
  });
  const { page, setPage } = table;
  const paymentStatus = table.values.payment_status,
    fulfillmentStatus = table.values.fulfillment_status;
  const appliedSearch = useDebouncedValue(table.values.search);
  const activeFilters = [
    table.values.search ? `Search: ${table.values.search}` : "",
    paymentStatus ? `Payment: ${paymentStatus}` : "",
    fulfillmentStatus
      ? `Fulfillment: ${fulfillmentStatus.replaceAll("_", " ")}`
      : "",
  ].filter(Boolean);

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
      align: "right" as const,
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

      <div>
        <FilterBar>
          <SearchInput
            label="Search orders"
            value={table.values.search}
            onChange={(value) => table.setFilters({ search: value }, true)}
          />
          <SelectField
            label="Payment"
            aria-label="Filter orders by payment status"
            value={paymentStatus}
            onChange={(event) =>
              table.setFilters({ payment_status: event.target.value })
            }
          >
            <option value="">All payment states</option>
            {payments.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Fulfillment"
            aria-label="Filter orders by fulfillment status"
            value={fulfillmentStatus}
            onChange={(event) =>
              table.setFilters({ fulfillment_status: event.target.value })
            }
          >
            <option value="">All fulfillment states</option>
            {fulfillments.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </SelectField>
        </FilterBar>
        <FilterSummary filters={activeFilters} onClear={table.clear} />
      </div>

      {query.kind === "loading" && <LoadingState label="Loading orders…" />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}

      {query.kind === "ready" && (
        <>
          <DataTable
            caption="Platform Orders"
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
    </div>
  );
}
