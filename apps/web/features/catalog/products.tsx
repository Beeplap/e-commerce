"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { useSeller } from "@/features/workspaces/seller-workspace";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
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
import { catalogApi, productStatuses, type Context } from "./api";

export function SellerProducts() {
  const access = useSeller();
  if (
    !access.permissions.includes("catalog.product.read") ||
    access.seller.status !== "active"
  )
    return <ForbiddenScreen />;
  return (
    <Products
      key={access.id}
      context={{ sellerId: access.seller.id }}
      canCreate={access.permissions.includes("catalog.product.create")}
    />
  );
}
export function PlatformProducts() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  if (!hasPlatformPermission(user, "platform.products.read"))
    return <ForbiddenScreen />;
  return <Products key={user?.id} context={{ platform: true }} />;
}
function Products({
  context,
  canCreate = false,
}: {
  context: Context;
  canCreate?: boolean;
}) {
  const platform = "platform" in context;
  const sellerId = "sellerId" in context ? context.sellerId : undefined;
  const table = useTableQuery(
    { search: 100, status: productStatuses },
    { status: platform ? "pending_review" : "" },
  );
  const { page, setPage } = table;
  const { status } = table.values;
  const search = useDebouncedValue(table.values.search);
  const activeFilters = [
    table.values.search ? `Search: ${table.values.search}` : "",
    status ? `Status: ${status.replaceAll("_", " ")}` : "",
  ].filter(Boolean);
  const load = useCallback(
    (signal: AbortSignal) =>
      catalogApi.products(
        sellerId ? { sellerId } : { platform: true },
        { page, search, ...(status ? { status } : {}) },
        signal,
      ),
    [sellerId, page, search, status],
  );
  const result = useApiQuery(
    `${sellerId ?? "platform"}:${page}:${search}:${status}`,
    load,
  );
  return (
    <>
      <PageHeader
        title={platform ? "Product moderation" : "Products"}
        description={
          platform
            ? "Review seller submissions and inspect their catalog."
            : "Manage your catalog, variants, and review submissions."
        }
        actions={
          canCreate && (
            <Link href="/seller/products/new" className={primaryButton}>
              Create product
            </Link>
          )
        }
      />
      <div className="mb-5">
        <FilterBar>
          <SearchInput
            label="Search products"
            value={table.values.search}
            onChange={(value) => table.setFilters({ search: value }, true)}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={(event) =>
              table.setFilters({ status: event.target.value })
            }
          >
            <option value="">All statuses</option>
            {productStatuses.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </SelectField>
        </FilterBar>
        <FilterSummary filters={activeFilters} onClear={table.clear} />
      </div>
      {result.kind === "loading" && <LoadingState />}
      {result.kind === "error" && (
        <ApiErrorState error={result.error} onRetry={result.retry} />
      )}
      {result.kind === "ready" && (
        <>
          <DataTable
            filtered={activeFilters.length > 0}
            caption="Products"
            rows={result.data.results}
            rowKey={(row) => row.id}
            columns={[
              {
                id: "name",
                heading: "Product",
                cell: (row) => (
                  <Link
                    className="font-semibold text-teal-900 underline"
                    href={`/${platform ? "admin" : "seller"}/products/${row.id}`}
                  >
                    {row.name}
                  </Link>
                ),
              },
              {
                id: "category",
                heading: "Category",
                cell: (row) => row.category.name,
              },
              {
                id: "brand",
                heading: "Brand",
                cell: (row) => row.brand?.name ?? "—",
              },
              {
                id: "status",
                heading: "Status",
                cell: (row) => <StatusBadge status={row.status} />,
              },
              ...(platform
                ? [
                    {
                      id: "seller",
                      heading: "Seller",
                      cell: (row: { seller_id: string }) => (
                        <Link
                          className="text-teal-900 underline"
                          href={`/admin/sellers/${row.seller_id}`}
                        >
                          Inspect seller
                        </Link>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <Pagination
            page={page}
            count={result.data.count}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
