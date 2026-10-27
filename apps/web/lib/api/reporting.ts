import type { PlatformDashboardMetrics } from "./types";
import { isUuid, record } from "./validation";

function invalid(): never {
  throw new Error("The server returned an invalid financial report.");
}
export function reportRecord(value: unknown): Record<string, unknown> {
  return record(value) ? value : invalid();
}
export function reportMoney(value: unknown): string {
  return typeof value === "string" && /^-?\d{1,28}\.\d{2}$/.test(value)
    ? value
    : invalid();
}
export function reportCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : invalid();
}
export function parseCurrencyScope(value: unknown, expectedCurrency?: string) {
  const row = reportRecord(value);
  if (
    typeof row.currency !== "string" ||
    !/^[A-Z]{3}$/.test(row.currency) ||
    (expectedCurrency !== undefined && row.currency !== expectedCurrency) ||
    !Array.isArray(row.available_currencies) ||
    row.available_currencies.length < 1 ||
    row.available_currencies.length > 256 ||
    !row.available_currencies.every(
      (code: unknown) => typeof code === "string" && /^[A-Z]{3}$/.test(code),
    ) ||
    new Set(row.available_currencies).size !==
      row.available_currencies.length ||
    !row.available_currencies.includes(row.currency)
  )
    invalid();
  return {
    currency: row.currency,
    available_currencies: row.available_currencies as string[],
  };
}
function text(value: unknown): string {
  return typeof value === "string" && value.length > 0 && value.length <= 255
    ? value
    : invalid();
}
function uuid(value: unknown): string {
  return isUuid(value) ? value : invalid();
}
function list<T>(
  value: unknown,
  maximum: number,
  parse: (value: unknown) => T,
): T[] {
  if (!Array.isArray(value) || value.length > maximum) invalid();
  return value.map(parse);
}
function unique(rows: { id: string }[]) {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) invalid();
}
function date(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid();
  const calendarDate = value.slice(0, 10);
  if (new Date(calendarDate).toISOString().slice(0, 10) !== calendarDate)
    invalid();
  return value;
}
function rate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : invalid();
}
export function parsePlatformDashboard(
  value: unknown,
  expectedCurrency: string,
): PlatformDashboardMetrics {
  const row = reportRecord(value),
    scope = parseCurrencyScope(row, expectedCurrency);
  const range = reportRecord(row.date_range);
  const start = date(range.start_date),
    end = date(range.end_date);
  if (
    Date.parse(start) > Date.parse(end) ||
    Date.parse(end) - Date.parse(start) > 366 * 86400000
  )
    invalid();
  const sellers = list(row.top_sellers, 5, (value) => {
    const seller = reportRecord(value);
    return {
      id: uuid(seller.id),
      name: text(seller.name),
      gross_sales: reportMoney(seller.gross_sales),
      orders_count: reportCount(seller.orders_count),
    };
  });
  const categories = list(row.top_categories, 5, (value) => {
    const category = reportRecord(value);
    return {
      id: uuid(category.id),
      name: text(category.name),
      revenue: reportMoney(category.revenue),
      orders_count: reportCount(category.orders_count),
    };
  });
  unique(sellers);
  unique(categories);
  const series = list(row.sales_over_time, 367, (value) => {
    const day = reportRecord(value),
      dayDate = date(day.date);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dayDate) ||
      new Date(dayDate).toISOString().slice(0, 10) !== dayDate
    )
      invalid();
    return {
      date: dayDate,
      gmv: reportMoney(day.gmv),
      platform_revenue: reportMoney(day.platform_revenue),
      orders_count: reportCount(day.orders_count),
    };
  });
  if (
    series.some(
      (day, index) => index > 0 && day.date <= series[index - 1]!.date,
    )
  )
    invalid();
  return {
    ...scope,
    date_range: { start_date: start, end_date: end },
    gmv: reportMoney(row.gmv),
    platform_revenue: reportMoney(row.platform_revenue),
    commission_revenue: reportMoney(row.commission_revenue),
    orders_count: reportCount(row.orders_count),
    active_sellers: reportCount(row.active_sellers),
    pending_seller_approvals: reportCount(row.pending_seller_approvals),
    customers_count: reportCount(row.customers_count),
    refund_rate: rate(row.refund_rate),
    return_rate: rate(row.return_rate),
    average_order_value: reportMoney(row.average_order_value),
    outstanding_seller_balances: reportMoney(row.outstanding_seller_balances),
    upcoming_payouts: reportMoney(row.upcoming_payouts),
    new_seller_registrations: reportCount(row.new_seller_registrations),
    top_categories: categories,
    top_sellers: sellers,
    sales_over_time: series,
  };
}
