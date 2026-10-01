"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
} from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { useApiQuery } from "@/lib/api/use-api-query";
import { sellerManagementApi } from "./api";
import { selectStyle } from "./forms";

export function PlatformSellers() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const canRead =
    user?.platform_permissions.includes("platform.sellers.read") ?? false;
  const [filters, setFilters] = useState({
    page: 1,
    search: "",
    status: "",
    verification_status: "",
  });
  const load = useCallback(
    (signal: AbortSignal) => sellerManagementApi.list(filters, signal),
    [filters],
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
        className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setFilters({
            page: 1,
            search: String(data.get("search") ?? ""),
            status: String(data.get("status") ?? ""),
            verification_status: String(data.get("verification_status") ?? ""),
          });
        }}
      >
        <label className="text-sm font-medium">
          Search
          <input
            className={`${selectStyle} mt-2`}
            type="search"
            name="search"
            maxLength={100}
            placeholder="Name or business email"
          />
        </label>
        <label className="text-sm font-medium">
          Seller status
          <select name="status" className={`${selectStyle} mt-2`}>
            <option value="">All statuses</option>
            {["pending", "active", "suspended", "rejected", "closed"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
        <label className="text-sm font-medium">
          Verification
          <select name="verification_status" className={`${selectStyle} mt-2`}>
            <option value="">All verification states</option>
            {["pending", "verified", "rejected"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className={`${primaryButton} self-end`} type="submit">
          Apply filters
        </button>
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
            onPageChange={(page) =>
              setFilters((current) => ({ ...current, page }))
            }
          />
        </>
      )}
    </>
  );
}
