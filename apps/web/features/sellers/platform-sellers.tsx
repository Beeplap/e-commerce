"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { sellerManagementApi } from "./api";
import { Button } from "@/components/ui/button";
import { FormField, SelectField } from "@/components/ui/form-fields";
import { FilterSummary } from "@/components/ui/filter-bar";
import { useTableQuery } from "@/components/ui/use-table-query";

export function PlatformSellers() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead =
    user?.platform_permissions.includes("platform.sellers.read") ?? false;
  const table = useTableQuery({
    search: 100,
    status: ["pending", "active", "suspended", "rejected", "closed"],
    verification_status: ["pending", "verified", "rejected"],
  });
  const filters = { page: table.page, ...table.values };
  const [draftInput, setDraft] = useState<typeof table.values | null>(null);
  const draft = draftInput ?? table.values;
  useEffect(() => {
    const resetDraft = () => setDraft(null);
    window.addEventListener("popstate", resetDraft);
    return () => window.removeEventListener("popstate", resetDraft);
  }, []);
  const activeFilters = [
    table.values.search ? `Search: ${table.values.search}` : "",
    table.values.status ? `Status: ${table.values.status}` : "",
    table.values.verification_status
      ? `Verification: ${table.values.verification_status}`
      : "",
  ].filter(Boolean);

  const load = useCallback(
    (signal: AbortSignal) =>
      sellerManagementApi.list({ page: table.page, ...table.values }, signal),
    [table.page, table.values],
  );
  const query = useApiQuery(
    canRead ? `${user?.id}:${JSON.stringify(filters)}` : null,
    load,
  );
  if (!canRead) return <ForbiddenScreen />;
  return (
    <>
      <PageHeader
        title="Sellers"
        description="Review registrations and manage seller availability."
      />
      <form
        className="mb-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setDraft(null);
          table.setFilters({
            search: String(data.get("search") ?? ""),
            status: String(data.get("status") ?? ""),
            verification_status: String(data.get("verification_status") ?? ""),
          });
        }}
      >
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <FormField
            label="Search"
            type="search"
            name="search"
            maxLength={100}
            placeholder="Name or business email"
            value={draft.search}
            onChange={(event) =>
              setDraft((previous) => ({
                ...(previous ?? table.values),
                search: event.target.value,
              }))
            }
          />
          <SelectField
            label="Seller status"
            name="status"
            value={draft.status}
            onChange={(event) =>
              setDraft((previous) => ({
                ...(previous ?? table.values),
                status: event.target.value,
              }))
            }
          >
            <option value="">All statuses</option>
            {["pending", "active", "suspended", "rejected", "closed"].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </SelectField>
          <SelectField
            label="Verification"
            name="verification_status"
            value={draft.verification_status}
            onChange={(event) =>
              setDraft((previous) => ({
                ...(previous ?? table.values),
                verification_status: event.target.value,
              }))
            }
          >
            <option value="">All verification states</option>
            {["pending", "verified", "rejected"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>
          <Button type="submit">Apply filters</Button>
        </div>
        <FilterSummary
          filters={activeFilters}
          onClear={() => {
            table.clear();
            setDraft(null);
          }}
        />
      </form>
      {query.kind === "loading" && <LoadingState label="Loading sellers…" />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <>
          <DataTable
            rows={query.data.results}
            rowKey={(seller) => seller.id}
            filtered={activeFilters.length > 0}
            caption="Platform sellers"
            columns={[
              {
                id: "name",
                heading: "Seller",
                cell: (seller) => (
                  <Link
                    href={`/admin/sellers/${seller.id}`}
                    className="font-semibold text-teal-900 underline"
                  >
                    {seller.display_name}
                  </Link>
                ),
              },
              {
                id: "legal",
                heading: "Legal name",
                cell: (seller) => seller.legal_name,
              },
              {
                id: "email",
                heading: "Contact",
                cell: (seller) => seller.email,
              },
              {
                id: "status",
                heading: "Status",
                cell: (seller) => <StatusBadge status={seller.status} />,
              },
              {
                id: "verification",
                heading: "Verification",
                cell: (seller) => (
                  <StatusBadge status={seller.verification_status} />
                ),
              },
            ]}
          />
          <Pagination
            page={filters.page}
            count={query.data.count}
            onPageChange={table.setPage}
          />
        </>
      )}
    </>
  );
}
