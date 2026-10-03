import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { AdminOverview, SellerOverview } from "@/features/workspaces/overview";
import type {
  PlatformDashboardMetrics,
  SellerDashboardMetrics,
} from "@/lib/api/types";
import { csrf, json, membership, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockSellerDashboard: SellerDashboardMetrics = {
  date_range: {
    start_date: "2026-09-02T00:00:00Z",
    end_date: "2026-10-02T00:00:00Z",
  },
  gross_sales: "5420.00",
  net_sales: "4878.00",
  orders_count: 42,
  average_order_value: "129.05",
  units_sold: 88,
  pending_orders: 3,
  low_stock_variants: 2,
  returns_count: 1,
  platform_fees: "542.00",
  available_balance: "3200.00",
  pending_balance: "450.00",
  payout_info: {
    total_paid_out: "12500.00",
    last_payout_amount: "2100.00",
    last_payout_status: "processed",
    last_payout_date: "2026-09-25T14:30:00Z",
  },
  top_products: [
    {
      id: "prod-1",
      name: "Wireless Earbuds Pro",
      units_sold: 35,
      revenue: "3465.00",
    },
  ],
  sales_over_time: [
    {
      date: "2026-10-01",
      gross_sales: "850.00",
      net_sales: "765.00",
      orders_count: 6,
    },
  ],
};

const mockPlatformDashboard: PlatformDashboardMetrics = {
  date_range: {
    start_date: "2026-09-02T00:00:00Z",
    end_date: "2026-10-02T00:00:00Z",
  },
  gmv: "98500.00",
  platform_revenue: "9850.00",
  commission_revenue: "9850.00",
  orders_count: 850,
  active_sellers: 24,
  pending_seller_approvals: 2,
  customers_count: 620,
  refund_rate: 1.8,
  return_rate: 2.4,
  average_order_value: "115.88",
  outstanding_seller_balances: "42000.00",
  upcoming_payouts: "15500.00",
  new_seller_registrations: 5,
  top_categories: [
    {
      id: "cat-1",
      name: "Electronics",
      units_sold: 450,
      revenue: "52000.00",
    },
  ],
  top_sellers: [
    {
      id: "seller-1",
      name: "Apex Electronics",
      gross_sales: "34000.00",
      orders_count: 310,
    },
  ],
  sales_over_time: [
    {
      date: "2026-10-01",
      gmv: "14200.00",
      platform_revenue: "1420.00",
      orders_count: 110,
    },
  ],
};

function setupFetch(
  options: {
    isAdmin?: boolean;
    sellerMetrics?: SellerDashboardMetrics;
    adminMetrics?: PlatformDashboardMetrics;
  } = {},
) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/v1/auth/csrf")) {
      return Promise.resolve(json({ csrf_token: csrf }));
    }
    if (url.includes("/api/v1/auth/me")) {
      return Promise.resolve(
        json(
          options.isAdmin
            ? { ...user, platform_permissions: ["platform.analytics.read"] }
            : user,
        ),
      );
    }
    if (url.includes("/api/v1/seller/memberships")) {
      return Promise.resolve(
        json({
          count: 1,
          next: null,
          previous: null,
          results: [membership],
        }),
      );
    }
    if (url.includes("/api/v1/seller/access")) {
      return Promise.resolve(json(membership));
    }
    if (url.includes("/api/v1/seller/analytics/dashboard")) {
      return Promise.resolve(
        json(options.sellerMetrics ?? mockSellerDashboard),
      );
    }
    if (url.includes("/api/v1/admin/analytics/dashboard")) {
      return Promise.resolve(
        json(options.adminMetrics ?? mockPlatformDashboard),
      );
    }
    return Promise.resolve(json({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderSellerOverview() {
  return render(
    <AuthProvider>
      <SellerWorkspace>
        <SellerOverview />
      </SellerWorkspace>
    </AuthProvider>,
  );
}

function renderAdminOverview() {
  return render(
    <AuthProvider>
      <AdminOverview />
    </AuthProvider>,
  );
}

describe("SellerOverview dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders seller performance KPIs, top products, balances, and operational alerts", async () => {
    setupFetch({ isAdmin: false });

    renderSellerOverview();

    // Wait for metrics to load
    await waitFor(() => {
      expect(screen.getByText("Gross Sales")).toBeDefined();
    });

    // Check heading
    expect(screen.getByRole("heading", { name: "Seller A" })).toBeDefined();

    // Check KPI values
    expect(screen.getByText("5,420.00 USD")).toBeDefined();
    expect(screen.getByText("4,878.00 USD")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined(); // Orders Placed
    expect(screen.getByText("88")).toBeDefined(); // Units Sold

    // Check balances
    expect(screen.getByText("3,200.00 USD")).toBeDefined();
    expect(screen.getByText("450.00 USD")).toBeDefined();

    // Check top products
    expect(screen.getByText("Wireless Earbuds Pro")).toBeDefined();
    expect(screen.getByText("3,465.00 USD")).toBeDefined();

    // Check operational badges
    expect(screen.getByText("Action needed")).toBeDefined();
    expect(screen.getByText("Low stock")).toBeDefined();
  });

  it("supports date range filtering via preset buttons", async () => {
    const fetchMock = setupFetch({ isAdmin: false });

    renderSellerOverview();

    await waitFor(() => {
      expect(screen.getByText("Gross Sales")).toBeDefined();
    });

    // Click "Last 7 days" button
    const btn7d = screen.getByRole("button", { name: "Last 7 days" });
    fireEvent.click(btn7d);

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const filteredCall = calls.find((c) =>
        String(c[0]).includes("start_date="),
      );
      expect(filteredCall).toBeDefined();
    });
  });
});

describe("AdminOverview dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders platform GMV, revenue, active sellers, refund rates, and top sellers", async () => {
    setupFetch({ isAdmin: true });

    renderAdminOverview();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Platform workspace" }),
      ).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByText("Platform GMV")).toBeDefined();
    });

    // Check platform metrics
    expect(screen.getByText("98,500.00 USD")).toBeDefined();
    expect(screen.getByText("9,850.00 USD")).toBeDefined();
    expect(screen.getByText("850")).toBeDefined();
    expect(screen.getByText("1.8%")).toBeDefined(); // Refund rate

    // Check top sellers
    expect(screen.getByText("Apex Electronics")).toBeDefined();
    expect(screen.getByText("34,000.00 USD")).toBeDefined();

    // Check top categories
    expect(screen.getByText("Electronics")).toBeDefined();
    expect(screen.getByText("52,000.00 USD")).toBeDefined();

    // Check pending approvals alert
    expect(screen.getByText("Review needed")).toBeDefined();
  });
});

describe("dashboard redesign contracts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("places current operational work before period performance without inventing a return queue", async () => {
    setupFetch();
    renderSellerOverview();
    const attention = await screen.findByRole("heading", {
      name: "Needs attention",
    });
    const performance = await screen.findByRole("heading", {
      name: "Business performance",
    });
    expect(
      attention.compareDocumentPosition(performance) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText("Submitted in the selected period"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/returns awaiting response/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "All time" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Last 30 days" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("avoids platform analytics requests without the explicit capability", async () => {
    const fetcher = setupFetch({ isAdmin: false });
    renderAdminOverview();
    await screen.findByRole("heading", { name: "You don’t have access" });
    expect(
      fetcher.mock.calls.some((call) =>
        String(call[0]).includes("admin/analytics"),
      ),
    ).toBe(false);
    expect(screen.queryByText("Platform GMV")).not.toBeInTheDocument();
  });

  it("uses actual category revenue even when the live payload has order counts rather than units", async () => {
    setupFetch({
      isAdmin: true,
      adminMetrics: {
        ...mockPlatformDashboard,
        top_categories: [
          {
            id: "cat-live",
            name: "Live category",
            revenue: "15.00",
            orders_count: 3,
          },
        ],
      } as unknown as PlatformDashboardMetrics,
    });
    renderAdminOverview();
    await screen.findByText("Live category");
    expect(screen.getByText("15.00 USD")).toBeInTheDocument();
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  it("shows empty activity and absent payouts without fabricated financial state", async () => {
    setupFetch({
      sellerMetrics: {
        ...mockSellerDashboard,
        top_products: [],
        sales_over_time: [],
        pending_orders: 0,
        low_stock_variants: 0,
        payout_info: {
          total_paid_out: "0.00",
          last_payout_amount: null,
          last_payout_date: null,
          last_payout_status: null,
        },
      },
    });
    renderSellerOverview();
    await screen.findByText("No payout requested yet");
    expect(
      screen.getByRole("heading", { name: "No sales activity" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Action needed")).not.toBeInTheDocument();
    expect(screen.queryByText("processed")).not.toBeInTheDocument();
  });
});
