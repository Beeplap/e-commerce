import type { PlatformDashboardMetrics } from "@/lib/api/types";
import type { AdminFinanceSummary } from "@/features/finance/api";
import { membership } from "./fixtures";

export function financeReport(currency = "USD"): AdminFinanceSummary {
  return {
    currency,
    available_currencies: ["NPR", "USD"],
    total_gross_sales: currency === "USD" ? "12.00" : "98765432109876.12",
    total_commissions: "1.20",
    total_available_balances: "10.80",
    total_pending_balances: "0.00",
    total_paid_out: "0.00",
    pending_payouts_count: 1,
    active_plans_count: 1,
  };
}
export function platformReport(currency = "USD"): PlatformDashboardMetrics {
  const amount = currency === "USD" ? "12.00" : "98765432109876.12";
  return {
    currency,
    available_currencies: ["NPR", "USD"],
    date_range: {
      start_date: "2026-10-01T00:00:00Z",
      end_date: "2026-10-26T00:00:00Z",
    },
    gmv: amount,
    platform_revenue: "1.20",
    commission_revenue: "1.20",
    orders_count: 1,
    active_sellers: 2,
    pending_seller_approvals: 0,
    customers_count: 1,
    refund_rate: 0,
    return_rate: 0,
    average_order_value: amount,
    outstanding_seller_balances: "10.80",
    upcoming_payouts: "2.00",
    new_seller_registrations: 0,
    top_categories: [
      {
        id: "30000000-0000-4000-8000-000000000002",
        name: "Report category",
        revenue: amount,
        orders_count: 1,
      },
    ],
    top_sellers: [
      {
        id: membership.seller.id,
        name: "Report seller",
        gross_sales: amount,
        orders_count: 1,
      },
    ],
    sales_over_time: [
      {
        date: "2026-10-25",
        gmv: amount,
        platform_revenue: "1.20",
        orders_count: 1,
      },
    ],
  };
}
