import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { SellerFinanceOverview } from "@/features/finance/seller-finance-overview";
import { SellerPromotions } from "@/features/sellers/promotions";
import type { Promotion } from "@/lib/api/types";
import { csrf, json, membership, page, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const promotion: Promotion = {
  id: "80000000-0000-4000-8000-000000000001",
  name: "Seasonal discount",
  description: "Existing promotion evidence",
  scope: "SELLER",
  discount_type: "PERCENTAGE",
  discount_value: "10.25",
  minimum_order_amount: null,
  maximum_discount_amount: null,
  starts_at: "2026-10-01T00:00:00Z",
  ends_at: null,
  is_active: true,
  usage_limit: 20,
  usage_count: 4,
  created_at: "2026-10-01T00:00:00Z",
};

function setup(
  permissions: string[],
  resource: (url: string, init?: RequestInit) => Response,
) {
  const access = {
    ...membership,
    permissions: ["seller.context.read", ...permissions],
  };
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/auth/csrf")) return json({ csrf_token: csrf });
    if (url.includes("/auth/me")) return json(user);
    if (url.includes("/seller/memberships")) return json(page([access]));
    if (url.includes("/seller/access")) return json(access);
    return resource(url, init);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("financial and promotion workflow preservation", () => {
  it("does not request payout evidence or offer payout commands without its separate capability", async () => {
    const fetch = setup(["finance.read"], (url) => {
      if (url.includes("/finance/balance"))
        return json({
          seller_id: membership.seller.id,
          currency: "NPR",
          current_balance: "9007199254740993.01",
          pending_balance: "20.10",
          total_paid_out: "15.00",
          updated_at: "2026-10-01T00:00:00Z",
        });
      if (url.includes("/finance/transactions"))
        return json({ count: 0, next: null, previous: null, results: [] });
      return json({ detail: "Not found" }, 404);
    });
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerFinanceOverview />
        </SellerWorkspace>
      </AuthProvider>,
    );
    expect(
      await screen.findByText("9,007,199,254,740,993.01 NPR"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request Payout" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recent Payouts" }),
    ).not.toBeInTheDocument();
    expect(
      fetch.mock.calls.some(([url]) =>
        String(url).includes("/finance/payouts"),
      ),
    ).toBe(false);
  });

  it("preserves full promotion evidence and hides mutation commands for read-only staff", async () => {
    setup(["promotions.read"], (url) =>
      url.includes("/api/v1/promotions/")
        ? json({ count: 1, next: null, previous: null, results: [promotion] })
        : json({ detail: "Not found" }, 404),
    );
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerPromotions />
        </SellerWorkspace>
      </AuthProvider>,
    );
    const table = await screen.findByRole("table", {
      name: "Seller promotions",
    });
    expect(within(table).getByText("10.25%")).toBeInTheDocument();
    expect(within(table).getByText("4 / 20")).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: "Coupons" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Deactivate" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New promotion" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a rejected promotion action visible and sends the original seller-scoped command", async () => {
    let request: RequestInit | undefined;
    setup(["promotions.read", "promotions.manage"], (url, init) => {
      if (url.endsWith(`${promotion.id}/`)) {
        request = init;
        return json({ detail: "Promotion action denied" }, 403);
      }
      if (url.includes("/api/v1/promotions/"))
        return json({
          count: 1,
          next: null,
          previous: null,
          results: [promotion],
        });
      return json({ detail: "Not found" }, 404);
    });
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerPromotions />
        </SellerWorkspace>
      </AuthProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Promotion action denied",
      ),
    );
    expect(request?.method).toBe("PATCH");
    expect(new Headers(request?.headers).get("X-Seller-ID")).toBe(
      membership.seller.id,
    );
    expect(new Headers(request?.headers).get("X-CSRFToken")).toBe(csrf);
    expect(request?.body).toBe(JSON.stringify({ is_active: false }));
    expect(screen.getByText("Seasonal discount")).toBeInTheDocument();
  });
});
