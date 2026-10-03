"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DateDisplay, Money } from "@/components/ui/displays";
import { ContentSection, StatGroup } from "@/components/ui/layout";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi, sellerApi } from "@/lib/api/client";
import type {
  DateRange,
  PlatformDashboardMetrics,
  SellerDashboardMetrics,
} from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { hasPlatformPermission } from "@/lib/permissions";
import { ForbiddenScreen } from "./forbidden-screen";
import { useSeller } from "./seller-workspace";
import { WorkspaceFrame } from "./workspace-frame";
import { TrendChart } from "./trend-chart";

type PresetRange = "7d" | "30d" | "90d";
function getDateRangeFromPreset(preset: PresetRange) {
  const end = new Date();
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  return {
    startDate: new Date(end.getTime() - days * 86400000).toISOString(),
    endDate: end.toISOString(),
  };
}
function RangeButtonGroup({
  current,
  onChange,
}: {
  current: PresetRange;
  onChange: (range: PresetRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Select date range"
      className="flex flex-wrap gap-1"
    >
      {(
        [
          ["7d", "Last 7 days"],
          ["30d", "Last 30 days"],
          ["90d", "Last 90 days"],
        ] as const
      ).map(([value, label]) => (
        <Button
          key={value}
          variant="secondary"
          aria-pressed={current === value}
          className={
            current === value
              ? "border-ui-accent bg-ui-selected text-ui-accent"
              : ""
          }
          onClick={() => onChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
function ReportingPeriod({ range }: { range: DateRange }) {
  const format = (date: string) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(date));
  return (
    <p className="text-ui-caption text-ui-secondary">
      Reporting period:{" "}
      <time dateTime={range.start_date}>{format(range.start_date)}</time> to{" "}
      <time dateTime={range.end_date}>{format(range.end_date)}</time> (UTC)
    </p>
  );
}
function AttentionList({
  items,
}: {
  items: {
    label: string;
    value: ReactNode;
    description: string;
    badge?: string;
    href?: string;
    action?: string;
  }[];
}) {
  return (
    <ul className="divide-y divide-ui-border">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{item.label}</p>
              {item.badge && (
                <span className="rounded-sm bg-ui-warning-surface px-2 py-0.5 text-ui-caption font-medium text-ui-warning">
                  {item.badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-ui-caption text-ui-secondary">
              {item.description}
            </p>
          </div>
          <span className="break-words text-lg font-semibold tabular-nums">
            {item.value}
          </span>
          {item.href && (
            <Link
              href={item.href}
              className="flex min-h-11 items-center text-sm font-medium text-ui-accent underline-offset-4 hover:underline"
            >
              {item.action}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function SellerOverview() {
  const membership = useSeller();
  const { state } = useAuth();
  const userId = state.kind === "authenticated" ? state.user.id : null;
  const seller = membership.seller,
    currency = seller.default_currency;
  const [rangePreset, setRangePreset] = useState<PresetRange>("30d");
  const loadMetrics = useCallback(
    (signal: AbortSignal) =>
      sellerApi.dashboardMetrics(
        seller.id,
        getDateRangeFromPreset(rangePreset),
        signal,
      ),
    [seller.id, rangePreset],
  );
  const query = useApiQuery<SellerDashboardMetrics>(
    userId ? `seller-dashboard:${userId}:${seller.id}:${rangePreset}` : null,
    loadMetrics,
  );
  const can = (capability: string) =>
    membership.permissions.includes(capability);
  return (
    <>
      <PageHeader
        title={seller.display_name}
        description={`${currency} / ${seller.timezone}`}
        actions={
          <RangeButtonGroup current={rangePreset} onChange={setRangePreset} />
        }
      />
      {query.kind === "loading" && (
        <LoadingState
          variant="dashboard"
          label="Loading seller performance metrics…"
        />
      )}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <div className="space-y-6">
          <section
            className="border-y border-ui-border bg-ui-surface px-4 py-5 sm:px-5"
            aria-labelledby="seller-attention-heading"
          >
            <h2
              id="seller-attention-heading"
              className="mb-4 text-ui-section font-semibold"
            >
              Needs attention
            </h2>
            <AttentionList
              items={[
                {
                  label: "Pending Orders",
                  value: number(query.data.pending_orders),
                  description: "Current orders awaiting fulfillment",
                  badge:
                    query.data.pending_orders > 0 ? "Action needed" : undefined,
                  href: can("orders.read") ? "/seller/orders" : undefined,
                  action: "View orders",
                },
                {
                  label: "Low Stock Items",
                  value: number(query.data.low_stock_variants),
                  description: "Stock positions at or below reorder level",
                  badge:
                    query.data.low_stock_variants > 0 ? "Low stock" : undefined,
                  href: can("inventory.read") ? "/seller/inventory" : undefined,
                  action: "Review inventory",
                },
              ]}
            />
          </section>
          <ContentSection id="seller-performance" title="Business performance">
            <ReportingPeriod range={query.data.date_range} />
            <StatGroup
              items={[
                {
                  label: "Gross Sales",
                  value: (
                    <Money
                      amount={query.data.gross_sales}
                      currency={currency}
                    />
                  ),
                  primary: true,
                  hint: "Before platform fees",
                },
                {
                  label: "Net Sales",
                  value: (
                    <Money amount={query.data.net_sales} currency={currency} />
                  ),
                  primary: true,
                  hint: "After platform commission",
                },
                {
                  label: "Orders Placed",
                  value: number(query.data.orders_count),
                },
                {
                  label: "Average order value",
                  value: (
                    <Money
                      amount={query.data.average_order_value}
                      currency={currency}
                    />
                  ),
                },
              ]}
            />
            <div className="border-t border-ui-border pt-4">
              <StatGroup
                items={[
                  { label: "Units Sold", value: number(query.data.units_sold) },
                  {
                    label: "Platform Fees",
                    value: (
                      <Money
                        amount={query.data.platform_fees}
                        currency={currency}
                      />
                    ),
                  },
                  {
                    label: "Return Requests",
                    value: number(query.data.returns_count),
                    hint: "Submitted in the selected period",
                  },
                ]}
              />
            </div>
          </ContentSection>
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <ContentSection id="seller-trend" title="Sales Trend">
              <TrendChart
                label="Gross sales"
                secondaryLabel="Net sales"
                currency={currency}
                points={query.data.sales_over_time.map((day) => ({
                  date: day.date,
                  value: day.gross_sales,
                  orders: day.orders_count,
                }))}
                secondaryValues={query.data.sales_over_time.map(
                  (day) => day.net_sales,
                )}
              />
            </ContentSection>
            <aside className="min-w-0 border-t border-ui-border pt-5 xl:border-t-0 xl:border-l xl:pl-5 xl:pt-0">
              <ContentSection
                id="seller-payouts"
                title="Balances & Payouts"
                actions={
                  can("finance.read") ? (
                    <Link
                      href="/seller/finance"
                      className="text-sm text-ui-accent hover:underline"
                    >
                      View finance
                    </Link>
                  ) : undefined
                }
              >
                <dl className="space-y-4">
                  <Detail label="Available Balance">
                    <span className="text-xl font-semibold">
                      <Money
                        amount={query.data.available_balance}
                        currency={currency}
                      />
                    </span>
                  </Detail>
                  <Detail label="Pending Balance">
                    <Money
                      amount={query.data.pending_balance}
                      currency={currency}
                    />
                  </Detail>
                  <Detail label="Total Paid Out">
                    <Money
                      amount={query.data.payout_info.total_paid_out}
                      currency={currency}
                    />
                  </Detail>
                  <Detail label="Last Payout">
                    {query.data.payout_info.last_payout_amount === null ? (
                      <span className="text-ui-secondary">
                        No payout requested yet
                      </span>
                    ) : (
                      <div className="space-y-2">
                        <Money
                          amount={query.data.payout_info.last_payout_amount}
                          currency={currency}
                        />
                        <div>
                          {query.data.payout_info.last_payout_status && (
                            <StatusBadge
                              status={query.data.payout_info.last_payout_status}
                            />
                          )}
                        </div>
                        {query.data.payout_info.last_payout_date && (
                          <p className="text-ui-caption text-ui-secondary">
                            <DateDisplay
                              value={query.data.payout_info.last_payout_date}
                              timezone={seller.timezone}
                            />
                          </p>
                        )}
                      </div>
                    )}
                  </Detail>
                </dl>
              </ContentSection>
            </aside>
          </div>
          <ContentSection
            id="seller-top-products"
            title="Top Products by Revenue"
          >
            <DataTable
              caption="Top products by revenue"
              rows={query.data.top_products}
              rowKey={(product) => product.id}
              columns={[
                {
                  id: "product",
                  heading: "Product",
                  cell: (product) =>
                    can("catalog.product.read") ? (
                      <Link
                        href={`/seller/products/${product.id}`}
                        className="font-medium text-ui-accent hover:underline"
                      >
                        {product.name}
                      </Link>
                    ) : (
                      product.name
                    ),
                },
                {
                  id: "units",
                  align: "right" as const,
                  heading: "Units sold",
                  cell: (product) => (
                    <span className="block text-right tabular-nums">
                      {number(product.units_sold)}
                    </span>
                  ),
                },
                {
                  id: "revenue",
                  align: "right" as const,
                  heading: "Revenue",
                  cell: (product) => (
                    <span className="block text-right">
                      <Money amount={product.revenue} currency={currency} />
                    </span>
                  ),
                },
              ]}
            />
          </ContentSection>
          <details className="border-t border-ui-border pt-4">
            <summary className="min-h-11 cursor-pointer text-sm font-medium text-ui-secondary">
              Workspace details
            </summary>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Detail label="Seller status">
                <StatusBadge status={seller.status} />
              </Detail>
              <Detail label="Verification">
                <StatusBadge status={seller.verification_status} />
              </Detail>
              <Detail label="Your role">
                {membership.role.name.toLowerCase().replaceAll("_", " ")}
              </Detail>
              <Detail label="Default currency">{currency}</Detail>
              <Detail label="Timezone">{seller.timezone}</Detail>
              <Detail label="Seller ID">
                <span className="break-all font-mono text-ui-caption">
                  {seller.id}
                </span>
              </Detail>
            </dl>
          </details>
        </div>
      )}
    </>
  );
}

export function AdminOverview() {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;
  const allowed = hasPlatformPermission(user, "platform.analytics.read");
  const [rangePreset, setRangePreset] = useState<PresetRange>("30d");
  const loadMetrics = useCallback(
    (signal: AbortSignal) =>
      adminApi.dashboardMetrics(getDateRangeFromPreset(rangePreset), signal),
    [rangePreset],
  );
  const query = useApiQuery<PlatformDashboardMetrics>(
    allowed && user ? `admin-dashboard:${user.id}:${rangePreset}` : null,
    loadMetrics,
  );
  if (state.kind === "loading")
    return <LoadingState label="Verifying admin session…" />;
  if (!user) return null;
  if (!allowed) return <ForbiddenScreen />;
  const can = (capability: string) => hasPlatformPermission(user, capability);
  return (
    <>
      <PageHeader
        title="Platform workspace"
        description="Marketplace operations and performance."
        actions={
          <RangeButtonGroup current={rangePreset} onChange={setRangePreset} />
        }
      />
      {query.kind === "loading" && (
        <LoadingState
          variant="dashboard"
          label="Loading platform dashboard metrics…"
        />
      )}
      {query.kind === "error" && (
        <ApiErrorState error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" && (
        <div className="space-y-6">
          <section
            className="border-y border-ui-border bg-ui-surface px-4 py-5 sm:px-5"
            aria-labelledby="platform-attention-heading"
          >
            <h2
              id="platform-attention-heading"
              className="mb-4 text-ui-section font-semibold"
            >
              Marketplace operations
            </h2>
            <AttentionList
              items={[
                {
                  label: "Pending Approvals",
                  value: number(query.data.pending_seller_approvals),
                  description: "Current sellers awaiting approval",
                  badge:
                    query.data.pending_seller_approvals > 0
                      ? "Review needed"
                      : undefined,
                  href: can("platform.sellers.read")
                    ? "/admin/sellers"
                    : undefined,
                  action: "Review sellers",
                },
                {
                  label: "Upcoming payouts",
                  value: (
                    <Money
                      amount={query.data.upcoming_payouts}
                      currency="USD"
                    />
                  ),
                  description: "Total of pending and approved payout requests",
                  href: can("platform.finance.read")
                    ? "/admin/finance/payouts"
                    : undefined,
                  action: "View payouts",
                },
                {
                  label: "Outstanding Balances",
                  value: (
                    <Money
                      amount={query.data.outstanding_seller_balances}
                      currency="USD"
                    />
                  ),
                  description: "Current seller balances",
                  href: can("platform.finance.read")
                    ? "/admin/finance/seller-balances"
                    : undefined,
                  action: "View balances",
                },
              ]}
            />
          </section>
          <ContentSection
            id="platform-performance"
            title="Marketplace performance"
          >
            <ReportingPeriod range={query.data.date_range} />
            <StatGroup
              items={[
                {
                  label: "Platform GMV",
                  value: <Money amount={query.data.gmv} currency="USD" />,
                  primary: true,
                  hint: "Gross merchandise value",
                },
                {
                  label: "Platform Revenue",
                  value: (
                    <Money
                      amount={query.data.platform_revenue}
                      currency="USD"
                    />
                  ),
                  primary: true,
                  hint: "Commission revenue",
                },
                {
                  label: "Total Orders",
                  value: number(query.data.orders_count),
                },
                {
                  label: "Average order value",
                  value: (
                    <Money
                      amount={query.data.average_order_value}
                      currency="USD"
                    />
                  ),
                },
              ]}
            />
            <div className="border-t border-ui-border pt-4">
              <StatGroup
                items={[
                  {
                    label: "Active Sellers",
                    value: number(query.data.active_sellers),
                    hint: `${number(query.data.new_seller_registrations)} new registrations in the period`,
                  },
                  {
                    label: "Customers",
                    value: number(query.data.customers_count),
                    hint: "All buyers with placed orders",
                  },
                  {
                    label: "Refund Rate",
                    value: `${query.data.refund_rate.toFixed(1)}%`,
                  },
                  {
                    label: "Return rate",
                    value: `${query.data.return_rate.toFixed(1)}%`,
                  },
                ]}
              />
            </div>
          </ContentSection>
          <ContentSection id="platform-trend" title="Marketplace trend">
            <TrendChart
              label="GMV"
              secondaryLabel="Platform revenue"
              currency="USD"
              points={query.data.sales_over_time.map((day) => ({
                date: day.date,
                value: day.gmv,
                orders: day.orders_count,
              }))}
              secondaryValues={query.data.sales_over_time.map(
                (day) => day.platform_revenue,
              )}
            />
          </ContentSection>
          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            <ContentSection
              id="platform-top-sellers"
              title="Top Sellers by GMV"
            >
              <DataTable
                caption="Top sellers by GMV"
                rows={query.data.top_sellers}
                rowKey={(seller) => seller.id}
                columns={[
                  {
                    id: "seller",
                    heading: "Seller",
                    cell: (seller) =>
                      can("platform.sellers.read") ? (
                        <Link
                          href={`/admin/sellers/${seller.id}`}
                          className="font-medium text-ui-accent hover:underline"
                        >
                          {seller.name}
                        </Link>
                      ) : (
                        seller.name
                      ),
                  },
                  {
                    id: "orders",
                    align: "right" as const,
                    heading: "Orders",
                    cell: (seller) => (
                      <span className="block text-right tabular-nums">
                        {number(seller.orders_count)}
                      </span>
                    ),
                  },
                  {
                    id: "gross",
                    align: "right" as const,
                    heading: "Gross sales",
                    cell: (seller) => (
                      <span className="block text-right">
                        <Money amount={seller.gross_sales} currency="USD" />
                      </span>
                    ),
                  },
                ]}
              />
            </ContentSection>
            <ContentSection
              id="platform-top-categories"
              title="Top Categories by GMV"
            >
              <DataTable
                caption="Top categories by GMV"
                rows={query.data.top_categories}
                rowKey={(category) => category.id}
                columns={[
                  {
                    id: "category",
                    heading: "Category",
                    cell: (category) => category.name,
                  },
                  {
                    id: "gmv",
                    align: "right" as const,
                    heading: "GMV",
                    cell: (category) => (
                      <span className="block text-right">
                        <Money amount={category.revenue} currency="USD" />
                      </span>
                    ),
                  },
                ]}
              />
            </ContentSection>
          </div>
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
