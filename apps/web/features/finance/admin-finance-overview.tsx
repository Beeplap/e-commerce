"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { ContentSection, StatGroup } from "@/components/ui/layout";
import { Money } from "@/components/ui/displays";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  primaryButton,
} from "@/components/ui/primitives";
import { getAdminFinanceSummary, type AdminFinanceSummary } from "./api";

export function AdminFinanceOverview() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!user || !hasPlatformPermission(user, "platform.finance.read")) {
    return <ForbiddenScreen />;
  }

  return <FinanceDashboard key={user.id} />;
}

function FinanceDashboard() {
  const loadSummary = useCallback(
    (signal: AbortSignal) => getAdminFinanceSummary(signal),
    [],
  );

  const query = useApiQuery("admin:finance:summary", loadSummary);

  if (query.kind === "loading") {
    return <LoadingState />;
  }

  if (query.kind === "error") {
    return <ApiErrorState error={query.error} onRetry={query.retry} />;
  }

  const summary: AdminFinanceSummary = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Finance"
        description="Balances, commissions and payouts."
        actions={
          <Link href="/admin/finance/payouts" className={primaryButton}>
            View payouts
          </Link>
        }
      />
      <section
        aria-label="Payout work"
        className="flex flex-wrap items-center justify-between gap-4 border-y border-ui-border py-5"
      >
        <div>
          <p className="text-ui-caption font-medium text-ui-secondary">
            Pending Payouts
          </p>
          <p className="mt-1 text-ui-page font-semibold tabular-nums">
            {summary.pending_payouts_count}
          </p>
        </div>
        <p className="text-ui-body text-ui-secondary">
          {summary.pending_payouts_count
            ? "Awaiting approval or processing"
            : "No payouts awaiting action"}
        </p>
        <Link
          href="/admin/finance/payouts"
          className="inline-flex min-h-11 items-center text-ui-body font-medium text-ui-accent hover:underline"
        >
          Review payouts
        </Link>
      </section>
      <ContentSection id="finance-balances" title="Seller funds">
        <StatGroup
          columns={2}
          items={[
            {
              label: "Available Balances",
              primary: true,
              value: (
                <Money
                  amount={summary.total_available_balances}
                  currency="USD"
                />
              ),
            },
            {
              label: "Pending Balances",
              value: (
                <Money amount={summary.total_pending_balances} currency="USD" />
              ),
            },
          ]}
        />
      </ContentSection>
      <div className="border-t border-ui-border pt-6">
        <ContentSection id="finance-performance" title="Lifetime activity">
          <StatGroup
            columns={3}
            items={[
              {
                label: "Total Gross Sales",
                value: (
                  <Money amount={summary.total_gross_sales} currency="USD" />
                ),
              },
              {
                label: "Platform Commissions",
                value: (
                  <Money amount={summary.total_commissions} currency="USD" />
                ),
              },
              {
                label: "Total Paid Out",
                value: <Money amount={summary.total_paid_out} currency="USD" />,
              },
            ]}
          />
        </ContentSection>
      </div>
      <section
        aria-label="Finance Operations"
        className="border-t border-ui-border"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ui-border py-4">
          <div>
            <h2 className="text-ui-body font-semibold">Commission Plans</h2>
            <p className="mt-1 text-ui-caption text-ui-secondary">
              {summary.active_plans_count} active plans
            </p>
          </div>
          <Link
            href="/admin/finance/commissions"
            className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
          >
            View commission plans
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ui-border py-4">
          <div>
            <h2 className="text-ui-body font-semibold">Seller Balances</h2>
            <p className="mt-1 text-ui-caption text-ui-secondary">
              Individual balances and adjustments
            </p>
          </div>
          <Link
            href="/admin/finance/seller-balances"
            className="inline-flex min-h-11 items-center text-ui-body text-ui-accent hover:underline"
          >
            View seller balances
          </Link>
        </div>
      </section>
    </div>
  );
}
