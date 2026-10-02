import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { SellerFinanceOverview } from "@/features/finance/seller-finance-overview";
import { SellerTransactions } from "@/features/finance/seller-transactions";
import { SellerPayouts } from "@/features/finance/seller-payouts";
import { AdminFinanceOverview } from "@/features/finance/admin-finance-overview";
import { AdminCommissions } from "@/features/finance/admin-commissions";
import { AdminSellerBalances } from "@/features/finance/admin-seller-balances";
import { AdminPayouts } from "@/features/finance/admin-payouts";
import type {
  SellerBalance,
  SellerLedgerEntry,
  Payout,
  CommissionPlan,
  AdminFinanceSummary,
  AdminSellerBalance,
} from "@/features/finance/api";
import { csrf, json, membership, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/finance",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockBalance: SellerBalance = {
  seller_id: membership.seller.id,
  currency: "USD",
  current_balance: "1250.50",
  pending_balance: "300.00",
  total_paid_out: "5000.00",
  updated_at: "2026-10-02T12:00:00Z",
};

const mockLedgerEntry: SellerLedgerEntry = {
  id: "e1000000-0000-4000-8000-000000000001",
  seller_id: membership.seller.id,
  entry_type: "SALE",
  amount: "150.00",
  balance_after: "1400.50",
  currency: "USD",
  seller_order_id: "e2000000-0000-4000-8000-000000000001",
  seller_order_number: "SO-ORD-999-SELLER",
  payout_id: null,
  payout_number: null,
  payment_reference: "",
  payout_reference: "",
  description: "Settlement for order SO-ORD-999-SELLER",
  created_at: "2026-10-02T12:30:00Z",
};

const mockPayout: Payout = {
  id: "a1000000-0000-4000-8000-000000000001",
  payout_number: "PO-20261002-0001",
  seller_id: membership.seller.id,
  seller_name: "Apex Trading",
  amount: "500.00",
  currency: "USD",
  status: "PENDING",
  period_start: null,
  period_end: null,
  created_at: "2026-10-02T13:00:00Z",
  approved_at: null,
  processed_at: null,
  created_by_email: "seller@example.com",
  approved_by_email: null,
  processed_by_email: null,
  notes: "Regular withdrawal",
  rejection_reason: "",
};

const mockPlan: CommissionPlan = {
  id: "c1000000-0000-4000-8000-000000000001",
  name: "Standard Marketplace Plan",
  description: "Default platform commission structure",
  default_percentage: "10.00",
  is_active: true,
  is_default: true,
  rules_count: 1,
  rules: [
    {
      id: "b1000000-0000-4000-8000-000000000001",
      plan_id: "c1000000-0000-4000-8000-000000000001",
      seller_id: null,
      seller_name: null,
      category_id: null,
      category_name: null,
      percentage: "8.50",
      fixed_fee: "0.00",
      priority: 10,
      is_active: true,
      created_at: "2026-10-02T10:00:00Z",
      updated_at: "2026-10-02T10:00:00Z",
    },
  ],
  created_at: "2026-10-02T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
};

const mockAdminSummary: AdminFinanceSummary = {
  total_gross_sales: "250000.00",
  total_commissions: "25000.00",
  total_available_balances: "75000.00",
  total_pending_balances: "15000.00",
  total_paid_out: "150000.00",
  pending_payouts_count: 3,
  active_plans_count: 2,
};

const mockAdminSellerBalance: AdminSellerBalance = {
  seller_id: membership.seller.id,
  seller_name: "Apex Trading",
  seller_slug: "apex-trading",
  currency: "USD",
  current_balance: "1250.50",
  pending_balance: "300.00",
  total_paid_out: "5000.00",
  updated_at: "2026-10-02T12:00:00Z",
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Seller Finance UI", () => {
  it("renders seller finance overview and requests payout", async () => {
    let requestedPayout: Payout | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({ ...user, platform_permissions: [] });
        if (url.includes("/api/v1/seller/memberships"))
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [membership],
          });
        if (url.includes("/api/v1/seller/access"))
          return json({
            ...membership,
            permissions: ["finance.read", "payouts.read"],
          });
        if (url.includes("/api/v1/seller/finance/balance"))
          return json(mockBalance);
        if (url.includes("/api/v1/seller/finance/transactions"))
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [mockLedgerEntry],
          });
        if (url.includes("/api/v1/seller/finance/payouts")) {
          if (init?.method === "POST") {
            requestedPayout = {
              ...mockPayout,
              amount: "200.00",
            };
            return json(requestedPayout);
          }
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [mockPayout],
          });
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerFinanceOverview />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Available Balance")).toBeInTheDocument();
    });

    expect(screen.getByText(/1,250\.50/)).toBeInTheDocument();
    expect(screen.getAllByText(/SO-ORD-999-SELLER/).length).toBeGreaterThan(0);

    // Open payout modal
    const requestBtn = screen.getByRole("button", { name: "Request Payout" });
    fireEvent.click(requestBtn);

    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: "200.00" },
    });
    fireEvent.change(screen.getByLabelText(/Notes/i), {
      target: { value: "Weekly transfer" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    await waitFor(() => {
      expect(requestedPayout).not.toBeNull();
    });
    expect((requestedPayout as unknown as Payout).amount).toBe("200.00");
  });

  it("denies access to seller finance when missing finance.read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({ ...user, platform_permissions: [] });
        if (url.includes("/api/v1/seller/memberships"))
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [membership],
          });
        if (url.includes("/api/v1/seller/access"))
          return json({
            ...membership,
            permissions: ["orders.read"], // lacks finance.read
          });
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerFinanceOverview />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("You don’t have access")).toBeInTheDocument();
    });
  });

  it("renders seller transactions view", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({ ...user, platform_permissions: [] });
        if (url.includes("/api/v1/seller/memberships"))
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [membership],
          });
        if (url.includes("/api/v1/seller/access"))
          return json({
            ...membership,
            permissions: ["finance.read"],
          });
        if (url.includes("/api/v1/seller/finance/transactions"))
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [mockLedgerEntry],
          });
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerTransactions />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Financial Ledger")).toBeInTheDocument();
      expect(screen.getAllByText(/SO-ORD-999-SELLER/).length).toBeGreaterThan(
        0,
      );
    });
  });

  it("renders seller payouts view", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({ ...user, platform_permissions: [] });
        if (url.includes("/api/v1/seller/memberships"))
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [membership],
          });
        if (url.includes("/api/v1/seller/access"))
          return json({
            ...membership,
            permissions: ["finance.read", "payouts.read"],
          });
        if (url.includes("/api/v1/seller/finance/balance"))
          return json(mockBalance);
        if (url.includes("/api/v1/seller/finance/payouts"))
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [mockPayout],
          });
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerPayouts />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("PO-20261002-0001")).toBeInTheDocument();
    });
  });
});

describe("Admin Finance UI", () => {
  it("renders admin finance overview when authorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({
            ...user,
            platform_permissions: ["platform.finance.read"],
          });
        if (url.includes("/api/v1/admin/finance/summary"))
          return json(mockAdminSummary);
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <AdminFinanceOverview />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Platform Finance")).toBeInTheDocument();
    });

    expect(screen.getByText(/250,000/)).toBeInTheDocument();
    expect(screen.getByText(/25,000/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // pending payouts count
  });

  it("denies access to admin finance when missing platform.finance.read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({
            ...user,
            platform_permissions: ["platform.sellers.read"], // lacks platform.finance.read
          });
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <AdminFinanceOverview />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("You don’t have access")).toBeInTheDocument();
    });
  });

  it("renders commission plans and allows creating a plan", async () => {
    let createdPlan: CommissionPlan | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({
            ...user,
            platform_permissions: [
              "platform.finance.read",
              "platform.finance.manage",
            ],
          });
        if (url.includes("/api/v1/admin/finance/commissions/plans")) {
          if (init?.method === "POST") {
            createdPlan = {
              ...mockPlan,
              id: "c2000000-0000-4000-8000-000000000001",
              name: "Electronics Special Tier",
              default_percentage: "6.00",
            };
            return json(createdPlan);
          }
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [mockPlan],
          });
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <AdminCommissions />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Standard Marketplace Plan")).toBeInTheDocument();
    });

    expect(screen.getByText("8.50%")).toBeInTheDocument();

    // Click New Commission Plan
    fireEvent.click(
      screen.getByRole("button", { name: "New Commission Plan" }),
    );

    expect(screen.getByLabelText(/Plan Name/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Plan Name/), {
      target: { value: "Electronics Special Tier" },
    });
    fireEvent.change(screen.getByLabelText(/Default Percentage/), {
      target: { value: "6.00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Plan" }));

    await waitFor(() => {
      expect(createdPlan).not.toBeNull();
    });
    expect((createdPlan as unknown as CommissionPlan).name).toBe(
      "Electronics Special Tier",
    );
  });

  it("renders seller balances and posts an adjustment", async () => {
    let postedAdjustment: { amount: string; description: string } | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({
            ...user,
            platform_permissions: [
              "platform.finance.read",
              "platform.finance.manage",
            ],
          });
        if (url.includes("/adjust") && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          postedAdjustment = body;
          return json({
            ...mockLedgerEntry,
            entry_type: "ADJUSTMENT",
            amount: body.amount,
            description: body.description,
          });
        }
        if (url.includes("/api/v1/admin/finance/seller-balances"))
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [mockAdminSellerBalance],
          });
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <AdminSellerBalances />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Apex Trading")).toBeInTheDocument();
    });

    expect(screen.getByText("@apex-trading")).toBeInTheDocument();

    // Click Adjust Balance
    fireEvent.click(screen.getByRole("button", { name: "Adjust Balance" }));

    expect(screen.getByLabelText(/Adjustment Amount/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Adjustment Amount/), {
      target: { value: "75.00" },
    });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Goodwill promotional credit" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Apply Adjustment" }));

    await waitFor(() => {
      expect(postedAdjustment).not.toBeNull();
    });
    const adj = postedAdjustment as unknown as {
      amount: string;
      description: string;
    };
    expect(adj.amount).toBe("75.00");
    expect(adj.description).toBe("Goodwill promotional credit");
  });

  it("renders admin payouts and executes approval, processing, and rejection", async () => {
    let approvedId: string | null = null;
    let rejectedReason: string | null = null;

    let payoutState: Payout = {
      ...mockPayout,
      status: "PENDING",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({
            ...user,
            platform_permissions: [
              "platform.finance.read",
              "platform.finance.manage",
            ],
          });
        if (url.endsWith("/approve") && init?.method === "POST") {
          approvedId = mockPayout.id;
          payoutState = { ...payoutState, status: "APPROVED" };
          return json(payoutState);
        }
        if (url.endsWith("/reject") && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          rejectedReason = body.reason;
          payoutState = {
            ...payoutState,
            status: "REJECTED",
            rejection_reason: body.reason,
          };
          return json(payoutState);
        }
        if (url.includes("/api/v1/admin/finance/payouts"))
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [payoutState],
          });
        return json({ detail: "Not found" }, 404);
      }),
    );

    const { rerender } = render(
      <AuthProvider>
        <AdminPayouts />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("PO-20261002-0001")).toBeInTheDocument();
    });

    // Approve the payout
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(approvedId).toBe(mockPayout.id);
    });

    // Re-render with approved payout to test processing or rejection
    payoutState = { ...payoutState, status: "APPROVED" };
    rerender(
      <AuthProvider>
        <AdminPayouts />
      </AuthProvider>,
    );

    // Reject the payout
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByLabelText(/Reason for Rejection/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Reason for Rejection/), {
      target: { value: "Suspicious banking activity" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Reject Payout" }));

    await waitFor(() => {
      expect(rejectedReason).toBe("Suspicious banking activity");
    });
  });
});
