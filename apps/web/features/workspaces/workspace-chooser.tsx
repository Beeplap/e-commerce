"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import {
  ApiErrorState,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
  primaryButton,
} from "@/components/ui/primitives";
import { sellerApi } from "@/lib/api/client";
import type { SellerMembership } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { hasPlatformPermission } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { WorkspaceFrame } from "./workspace-frame";

const columns: Column<SellerMembership>[] = [
  {
    id: "seller",
    heading: "Seller",
    cell: (membership) => (
      <span className="font-medium">{membership.seller.display_name}</span>
    ),
  },
  {
    id: "role",
    heading: "Your role",
    cell: (membership) => (
      <span className="capitalize">
        {membership.role.name.toLowerCase().replaceAll("_", " ")}
      </span>
    ),
  },
  {
    id: "status",
    heading: "Seller status",
    cell: (membership) => <StatusBadge status={membership.seller.status} />,
  },
];

export function WorkspaceChooser() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const [page, setPage] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) => sellerApi.memberships(page, signal),
    [page],
  );
  const memberships = useApiQuery(user ? `${user.id}:${page}` : null, load);
  return (
    <WorkspaceFrame mode="workspaces">
      <PageHeader
        title="Your workspaces"
        actions={
          <Link href="/onboarding" className={primaryButton}>
            Register a business
          </Link>
        }
        description="Choose where you’d like to work. Your account may have access to several sellers or the platform."
      />
      {memberships.kind === "error" && (
        <ApiErrorState error={memberships.error} onRetry={memberships.retry} />
      )}
      <div className="mb-9 grid gap-5 lg:grid-cols-2">
        {hasPlatformPermission(user, "platform.access") && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">
              Platform
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              Platform administration
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Open your platform administration workspace.
            </p>
            <Link href="/admin" className={`${primaryButton} mt-5`}>
              Open platform workspace
            </Link>
          </section>
        )}
        {memberships.kind === "ready" && memberships.data.count > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">
              Seller
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              Seller administration
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {memberships.data.count}{" "}
              {memberships.data.count === 1
                ? "seller workspace is"
                : "seller workspaces are"}{" "}
              available. Choose your seller inside the workspace.
            </p>
            <Link href="/seller" className={`${primaryButton} mt-5`}>
              Open seller workspace
            </Link>
          </section>
        )}
      </div>
      {memberships.kind === "loading" && (
        <LoadingState label="Loading your seller memberships…" />
      )}
      {memberships.kind === "ready" &&
        (memberships.data.count === 0 ? (
          <EmptyState
            title="No seller workspaces"
            description="Your account has no available seller memberships. Contact the seller owner or platform support if you expected access."
          />
        ) : (
          <section aria-labelledby="seller-memberships-heading">
            <h2
              id="seller-memberships-heading"
              className="mb-4 text-lg font-semibold"
            >
              Your seller memberships
            </h2>
            <DataTable
              rows={memberships.data.results}
              columns={columns}
              rowKey={(membership) => membership.id}
              caption="Your seller memberships"
            />
            <Pagination
              page={page}
              count={memberships.data.count}
              onPageChange={setPage}
            />
          </section>
        ))}
    </WorkspaceFrame>
  );
}
