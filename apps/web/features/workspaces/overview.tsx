"use client";

import { useCallback, useState } from "react";
import { DateDisplay, Money } from "@/components/ui/displays";
import {
  ApiErrorState,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi, sellerApi } from "@/lib/api/client";
import type {
  PlatformDashboardMetrics,
  SellerDashboardMetrics,
} from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { useSeller } from "./seller-workspace";
import { WorkspaceFrame } from "./workspace-frame";

type PresetRange = "7d" | "30d" | "90d" | "all";

function getDateRangeFromPreset(preset: PresetRange): {
  startDate?: string;
  endDate?: string;
} {
  if (preset === "all") return {};
  const end = new Date();
  const start = new Date();
  if (preset === "7d") start.setDate(end.getDate() - 7);
  else if (preset === "30d") start.setDate(end.getDate() - 30);
  else if (preset === "90d") start.setDate(end.getDate() - 90);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

function StatCard({
  title,
  value,
  subtext,
  badge,
  badgeTone = "default",
}: {
  title: string;
  value: React.ReactNode;
  subtext?: string;
  badge?: string;
  badgeTone?: "default" | "success" | "warning" | "danger";
}) {
  const badgeColors = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {badge && (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeColors[badgeTone]}`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
}

function RangeButtonGroup({
  current,
  onChange,
}: {
  current: PresetRange;
  onChange: (range: PresetRange) => void;
}) {
  const options: { label: string; value: PresetRange }[] = [
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "Last 90 days", value: "90d" },
    { label: "All time", value: "all" },
  ];
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
      role="group"
      aria-label="Select date range"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            current === opt.value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function SellerOverview() {
  const membership = useSeller();
  const seller = membership.seller;
  const currency = seller.default_currency;
  const [rangePreset, setRangePreset] = useState<PresetRange>("30d");

  const loadMetrics = useCallback(
    (signal: AbortSignal) => {
      const dates = getDateRangeFromPreset(rangePreset);
      return sellerApi.dashboardMetrics(seller.id, dates, signal);
    },
    [seller.id, rangePreset],
  );

  const query = useApiQuery<SellerDashboardMetrics>(
    `seller-dashboard:${seller.id}:${rangePreset}`,
    loadMetrics,
  );

  return (
    <>
      <PageHeader
        title={seller.display_name}
        description="Performance overview, sales analytics, and operational metrics."
        actions={
          <RangeButtonGroup current={rangePreset} onChange={setRangePreset} />
        }
      />

      {query.kind === "loading" && (
        <LoadingState label="Loading seller performance metrics…" />
      )}

      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}

      {query.kind === "ready" && (
        <div className="space-y-8">
          {/* Top KPI Cards */}
          <section aria-labelledby="seller-kpi-heading">
            <h2 id="seller-kpi-heading" className="sr-only">
              Key performance indicators
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Gross Sales"
                value={
                  <Money amount={query.data.gross_sales} currency={currency} />
                }
                subtext="Total order volume before fees"
              />
              <StatCard
                title="Net Sales"
                value={
                  <Money amount={query.data.net_sales} currency={currency} />
                }
                subtext="Seller revenue after platform commission"
                badgeTone="success"
                badge="Net"
              />
              <StatCard
                title="Orders Placed"
                value={query.data.orders_count.toLocaleString()}
                subtext={`Avg order value: ${query.data.average_order_value} ${currency}`}
              />
              <StatCard
                title="Units Sold"
                value={query.data.units_sold.toLocaleString()}
                subtext="Physical items purchased"
              />
            </div>
          </section>

          {/* Operational Metrics Cards */}
          <section aria-labelledby="seller-operational-heading">
            <h2 id="seller-operational-heading" className="sr-only">
              Operational alerts and balances
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Pending Orders"
                value={query.data.pending_orders.toLocaleString()}
                subtext="Orders awaiting fulfillment"
                badge={
                  query.data.pending_orders > 0 ? "Action needed" : undefined
                }
                badgeTone={
                  query.data.pending_orders > 0 ? "warning" : "default"
                }
              />
              <StatCard
                title="Low Stock Items"
                value={query.data.low_stock_variants.toLocaleString()}
                subtext="Variants at or below reorder level"
                badge={
                  query.data.low_stock_variants > 0 ? "Low stock" : undefined
                }
                badgeTone={
                  query.data.low_stock_variants > 0 ? "danger" : "default"
                }
              />
              <StatCard
                title="Return Requests"
                value={query.data.returns_count.toLocaleString()}
                subtext="Customer return submissions"
              />
              <StatCard
                title="Platform Fees"
                value={
                  <Money
                    amount={query.data.platform_fees}
                    currency={currency}
                  />
                }
                subtext="Commissions retained by marketplace"
              />
            </div>
          </section>

          {/* Financial Balances & Payout Info */}
          <section
            aria-labelledby="seller-payouts-heading"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2
              id="seller-payouts-heading"
              className="text-lg font-semibold text-slate-900"
            >
              Balances &amp; Payouts
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-xs font-medium text-slate-500">
                  Available Balance
                </span>
                <p className="mt-1 text-xl font-bold text-emerald-700">
                  <Money
                    amount={query.data.available_balance}
                    currency={currency}
                  />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Eligible for scheduled payout
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">
                  Pending Balance
                </span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  <Money
                    amount={query.data.pending_balance}
                    currency={currency}
                  />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Subject to hold period
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">
                  Total Paid Out
                </span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  <Money
                    amount={query.data.payout_info.total_paid_out}
                    currency={currency}
                  />
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cumulative historical payouts
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">
                  Last Payout
                </span>
                {query.data.payout_info.last_payout_amount ? (
                  <>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      <Money
                        amount={query.data.payout_info.last_payout_amount}
                        currency={currency}
                      />
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 capitalize">
                      {query.data.payout_info.last_payout_status ?? "Processed"}
                      {query.data.payout_info.last_payout_date && (
                        <>
                          {" "}
                          ·{" "}
                          <DateDisplay
                            value={query.data.payout_info.last_payout_date}
                          />
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    No payout processed yet
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Top Products Table & Sales Trend */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Products */}
            <section
              aria-labelledby="top-products-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2
                id="top-products-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Top Products by Revenue
              </h2>
              {query.data.top_products.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No product sales"
                    description="No orders were placed in the selected time range."
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="py-2.5 pr-4 font-semibold">
                          Product
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 px-4 font-semibold text-right"
                        >
                          Units Sold
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 pl-4 font-semibold text-right"
                        >
                          Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {query.data.top_products.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {p.name}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {p.units_sold.toLocaleString()}
                          </td>
                          <td className="py-3 pl-4 text-right font-semibold tabular-nums text-slate-900">
                            <Money amount={p.revenue} currency={currency} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Sales Trend (Daily Table / List) */}
            <section
              aria-labelledby="sales-trend-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2
                id="sales-trend-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Sales Trend
              </h2>
              {query.data.sales_over_time.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No sales activity"
                    description="No order activity recorded in the selected period."
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="py-2.5 pr-4 font-semibold">
                          Date
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 px-4 font-semibold text-right"
                        >
                          Orders
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 px-4 font-semibold text-right"
                        >
                          Gross
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 pl-4 font-semibold text-right"
                        >
                          Net
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {query.data.sales_over_time.slice(-10).map((day) => (
                        <tr key={day.date}>
                          <td className="py-2.5 pr-4 text-xs text-slate-600">
                            <time dateTime={day.date}>{day.date}</time>
                          </td>
                          <td className="py-2.5 px-4 text-right text-xs tabular-nums text-slate-700">
                            {day.orders_count}
                          </td>
                          <td className="py-2.5 px-4 text-right font-medium tabular-nums text-slate-900">
                            <Money
                              amount={day.gross_sales}
                              currency={currency}
                            />
                          </td>
                          <td className="py-2.5 pl-4 text-right font-medium tabular-nums text-emerald-700">
                            <Money amount={day.net_sales} currency={currency} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Workspace Details */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">
              Workspace details
            </h2>
            <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Seller status">
                <StatusBadge status={seller.status} />
              </Detail>
              <Detail label="Verification">
                <StatusBadge status={seller.verification_status} />
              </Detail>
              <Detail label="Your role">
                <span className="capitalize">
                  {membership.role.name.toLowerCase().replaceAll("_", " ")}
                </span>
              </Detail>
              <Detail label="Default currency">
                {seller.default_currency}
              </Detail>
              <Detail label="Timezone">{seller.timezone}</Detail>
              <Detail label="Seller ID">
                <span className="font-mono text-xs text-slate-600">
                  {seller.id}
                </span>
              </Detail>
            </dl>
          </section>
        </div>
      )}
    </>
  );
}

export function AdminOverview() {
  const { state } = useAuth();
  const [rangePreset, setRangePreset] = useState<PresetRange>("30d");

  const loadMetrics = useCallback(
    (signal: AbortSignal) => {
      const dates = getDateRangeFromPreset(rangePreset);
      return adminApi.dashboardMetrics(dates, signal);
    },
    [rangePreset],
  );

  const query = useApiQuery<PlatformDashboardMetrics>(
    `admin-dashboard:${rangePreset}`,
    loadMetrics,
  );

  if (state.kind === "loading") {
    return <LoadingState label="Verifying admin session…" />;
  }
  if (state.kind !== "authenticated") return null;

  return (
    <>
      <PageHeader
        title="Platform workspace"
        description="Marketplace GMV, platform revenue, seller status, and operational health."
        actions={
          <RangeButtonGroup current={rangePreset} onChange={setRangePreset} />
        }
      />

      {query.kind === "loading" && (
        <LoadingState label="Loading platform dashboard metrics…" />
      )}

      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}

      {query.kind === "ready" && (
        <div className="space-y-8">
          {/* Top Platform KPIs */}
          <section aria-labelledby="platform-kpi-heading">
            <h2 id="platform-kpi-heading" className="sr-only">
              Platform key metrics
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Platform GMV"
                value={<Money amount={query.data.gmv} currency="USD" />}
                subtext="Gross merchandise value across marketplace"
              />
              <StatCard
                title="Platform Revenue"
                value={
                  <Money amount={query.data.platform_revenue} currency="USD" />
                }
                subtext="Commission revenue collected"
                badgeTone="success"
                badge="Revenue"
              />
              <StatCard
                title="Total Orders"
                value={query.data.orders_count.toLocaleString()}
                subtext={`Average order value: $${query.data.average_order_value}`}
              />
              <StatCard
                title="Active Sellers"
                value={query.data.active_sellers.toLocaleString()}
                subtext={`${query.data.new_seller_registrations} new registrations`}
              />
            </div>
          </section>

          {/* Secondary KPIs */}
          <section aria-labelledby="platform-secondary-kpi-heading">
            <h2 id="platform-secondary-kpi-heading" className="sr-only">
              Platform operational and risk indicators
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Pending Approvals"
                value={query.data.pending_seller_approvals.toLocaleString()}
                subtext="Sellers awaiting verification"
                badge={
                  query.data.pending_seller_approvals > 0
                    ? "Review needed"
                    : undefined
                }
                badgeTone={
                  query.data.pending_seller_approvals > 0
                    ? "warning"
                    : "default"
                }
              />
              <StatCard
                title="Customers"
                value={query.data.customers_count.toLocaleString()}
                subtext="Unique buyers with placed orders"
              />
              <StatCard
                title="Refund Rate"
                value={`${query.data.refund_rate.toFixed(1)}%`}
                subtext={`Return rate: ${query.data.return_rate.toFixed(1)}%`}
                badgeTone={query.data.refund_rate > 5 ? "warning" : "default"}
              />
              <StatCard
                title="Outstanding Balances"
                value={
                  <Money
                    amount={query.data.outstanding_seller_balances}
                    currency="USD"
                  />
                }
                subtext={`Upcoming payouts: $${query.data.upcoming_payouts}`}
              />
            </div>
          </section>

          {/* Top Sellers and Top Categories */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Sellers */}
            <section
              aria-labelledby="top-sellers-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2
                id="top-sellers-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Top Sellers by GMV
              </h2>
              {query.data.top_sellers.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No seller sales"
                    description="No seller sales recorded in the selected period."
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="py-2.5 pr-4 font-semibold">
                          Seller
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 px-4 font-semibold text-right"
                        >
                          Orders
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 pl-4 font-semibold text-right"
                        >
                          Gross Sales
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {query.data.top_sellers.map((s) => (
                        <tr key={s.id}>
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {s.name}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {s.orders_count.toLocaleString()}
                          </td>
                          <td className="py-3 pl-4 text-right font-semibold tabular-nums text-slate-900">
                            <Money amount={s.gross_sales} currency="USD" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Top Categories */}
            <section
              aria-labelledby="top-categories-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2
                id="top-categories-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Top Categories by GMV
              </h2>
              {query.data.top_categories.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No category sales"
                    description="No category sales recorded in the selected period."
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="py-2.5 pr-4 font-semibold">
                          Category
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 px-4 font-semibold text-right"
                        >
                          Units Sold
                        </th>
                        <th
                          scope="col"
                          className="py-2.5 pl-4 font-semibold text-right"
                        >
                          GMV
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {query.data.top_categories.map((c) => (
                        <tr key={c.id}>
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {c.name}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {c.units_sold.toLocaleString()}
                          </td>
                          <td className="py-3 pl-4 text-right font-semibold tabular-nums text-slate-900">
                            <Money amount={c.revenue} currency="USD" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Account Details */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">
              Account details
            </h2>
            <dl className="grid gap-6 sm:grid-cols-2">
              <Detail label="Signed in as">{state.user.email}</Detail>
              <Detail label="Email verification">
                <StatusBadge
                  status={state.user.is_email_verified ? "verified" : "pending"}
                />
              </Detail>
            </dl>
          </section>
        </div>
      )}
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-2 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export function AccountOverview() {
  const { state } = useAuth();
  if (state.kind !== "authenticated") return null;
  const user = state.user;
  return (
    <WorkspaceFrame mode="account">
      <PageHeader
        title="My account"
        description="Your account identity and email verification status."
      />
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-6 sm:grid-cols-2">
          <Detail label="Name">
            {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
              "Not set"}
          </Detail>
          <Detail label="Email address">{user.email}</Detail>
          <Detail label="Email verification">
            <StatusBadge
              status={user.is_email_verified ? "verified" : "pending"}
            />
          </Detail>
        </dl>
      </section>
    </WorkspaceFrame>
  );
}
