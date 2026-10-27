"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ReportingCurrency } from "@/components/ui/reporting-currency";
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
  const [currency, setCurrency] = useState("USD");
  const loadSummary = useCallback(
    (signal: AbortSignal) => getAdminFinanceSummary(signal, currency),
    [currency],
  );

  const query = useApiQuery(`admin:finance:summary:${currency}`, loadSummary);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Finance"
        description={`Amounts and pending payouts in ${currency}. Commission plans apply across currencies.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ReportingCurrency
              currency={currency}
              currencies={
                query.kind === "ready" ? query.data.available_currencies : null
              }
              onChange={setCurrency}
            />
            <Link href="/admin/finance/payouts" className={primaryButton}>
              View payouts
            </Link>
          </div>
        }
      />
      {query.kind === "loading" && <LoadingState />}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && <FinanceSummaryContent summary={query.data} />}
    </div>
  );
}

function FinanceSummaryContent({ summary }: { summary: AdminFinanceSummary }) {
  return (
    <>
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
                  currency={summary.currency}
                />
              ),
            },
            {
              label: "Pending Balances",
              value: (
                <Money
                  amount={summary.total_pending_balances}
                  currency={summary.currency}
                />
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
                  <Money
                    amount={summary.total_gross_sales}
                    currency={summary.currency}
                  />
                ),
              },
              {
                label: "Platform Commissions",
                value: (
                  <Money
                    amount={summary.total_commissions}
                    currency={summary.currency}
                  />
                ),
              },
              {
                label: "Total Paid Out",
                value: (
                  <Money
                    amount={summary.total_paid_out}
                    currency={summary.currency}
                  />
                ),
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
    </>
  );
}
