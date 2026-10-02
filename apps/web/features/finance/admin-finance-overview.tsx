"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { Money } from "@/components/ui/displays";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  primaryButton,
  secondaryButton,
} from "@/components/ui/primitives";
import { getAdminFinanceSummary, type AdminFinanceSummary } from "./api";

export function AdminFinanceOverview() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!hasPlatformPermission(user, "platform.finance.read")) {
    return <ForbiddenScreen />;
  }

  return <FinanceDashboard />;
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Platform Finance"
        description="Marketplace financial accounting, commission revenues, seller balances, and payout management."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/finance/commissions" className={secondaryButton}>
              Commission Plans
            </Link>
            <Link
              href="/admin/finance/seller-balances"
              className={secondaryButton}
            >
              Seller Balances
            </Link>
            <Link href="/admin/finance/payouts" className={primaryButton}>
              Manage Payouts
            </Link>
          </div>
        }
      />

      {/* Summary Metrics */}
      <section aria-label="Financial Summary" className="mb-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Gross Sales
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              <Money amount={summary.total_gross_sales} currency="USD" />
            </p>
            <p className="mt-1 text-xs text-slate-500">Cumulative order GMV</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Platform Commissions
            </p>
            <p className="mt-2 text-2xl font-bold text-teal-700">
              <Money amount={summary.total_commissions} currency="USD" />
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Earned marketplace fees
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Available Balances
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              <Money amount={summary.total_available_balances} currency="USD" />
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Seller claimable funds
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Paid Out
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              <Money amount={summary.total_paid_out} currency="USD" />
            </p>
            <p className="mt-1 text-xs text-slate-500">Settled disbursements</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending Payouts
              </p>
              <p className="mt-1 text-3xl font-bold text-amber-700">
                {summary.pending_payouts_count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Withdrawals awaiting approval or processing
              </p>
            </div>
            <Link
              href="/admin/finance/payouts"
              className="rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              Review payouts &rarr;
            </Link>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Commission Plans
              </p>
              <p className="mt-1 text-3xl font-bold text-teal-800">
                {summary.active_plans_count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Fee rate configurations currently effective
              </p>
            </div>
            <Link
              href="/admin/finance/commissions"
              className="rounded-lg bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100"
            >
              Manage plans &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Sections Navigation */}
      <section
        aria-label="Finance Operations"
        className="grid grid-cols-1 gap-6 md:grid-cols-3"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900">
            Commission Plans
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Define global default commission percentages, category-specific
            rates, and custom seller contracts.
          </p>
          <div className="mt-4">
            <Link
              href="/admin/finance/commissions"
              className="text-sm font-medium text-teal-800 hover:underline"
            >
              Go to Commissions &rarr;
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900">
            Seller Balances
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Inspect individual seller current balances, pending escrows, and
            record manual compensating adjustments.
          </p>
          <div className="mt-4">
            <Link
              href="/admin/finance/seller-balances"
              className="text-sm font-medium text-teal-800 hover:underline"
            >
              View Seller Balances &rarr;
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900">
            Payout Approvals
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Authorize seller withdrawal requests, verify payout eligibility, and
            submit disbursement references.
          </p>
          <div className="mt-4">
            <Link
              href="/admin/finance/payouts"
              className="text-sm font-medium text-teal-800 hover:underline"
            >
              Process Payouts &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
