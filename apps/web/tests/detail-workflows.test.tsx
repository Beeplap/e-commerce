import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordDetails } from "@/components/ui/record-details";
import { Timeline } from "@/components/ui/timeline";
import { PayoutDetail } from "@/features/finance/payout-detail";
import { ReviewDetail } from "@/features/sellers/review-detail";
import { RelatedOrderWork } from "@/features/orders/related-order-work";
import { AdminPayouts } from "@/features/finance/admin-payouts";
import { PlatformSellerDetail } from "@/features/sellers/platform-detail";
import { AuthProvider } from "@/features/auth/auth-provider";
import type { Payout } from "@/features/finance/api";
import { json, membership, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/sellers",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const payout: Payout = {
  id: "a1000000-0000-4000-8000-000000000001",
  payout_number: "PO-123",
  seller_id: membership.seller.id,
  seller_name: "Seller A",
  amount: "123456789012345678.90",
  currency: "NPR",
  status: "REJECTED",
  period_start: null,
  period_end: null,
  created_at: "2026-10-01T01:00:00Z",
  approved_at: "2026-10-02T01:00:00Z",
  processed_at: null,
  created_by_email: "requester@example.com",
  approved_by_email: "reviewer@example.com",
  processed_by_email: null,
  notes: "Full untruncated request notes",
  rejection_reason: "Incorrect settlement details",
};

describe("operational detail views", () => {
  it("renders nested recorded addresses as labeled text and escapes submitted markup", () => {
    const { container } = render(
      <RecordDetails
        value={{
          address_line1: "<img src=x onerror=alert(1)>",
          city: "Kathmandu",
          contact: { name: "Alex", phone: "123" },
          instructions: ["Front door", "Call first"],
        }}
      />,
    );
    expect(screen.getByText("address line1")).toBeInTheDocument();
    expect(screen.getByText("Kathmandu")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(
      screen.getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
    expect(container.querySelector("img, pre")).toBeNull();
  });

  it("preserves event order and does not invent timestamps or actors", () => {
    render(
      <Timeline
        label="Recorded events"
        entries={[
          {
            id: "2",
            title: "Received",
            occurredAt: "2026-10-02T01:00:00Z",
            description: "Inspected",
          },
          { id: "1", title: "Requested", occurredAt: null },
        ]}
      />,
    );
    const entries = within(
      screen.getByRole("list", { name: "Recorded events" }),
    ).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("Received");
    expect(entries[1]).toHaveTextContent("Requested");
    expect(entries[1]?.querySelector("time")).toBeNull();
    expect(screen.queryByText("System")).not.toBeInTheDocument();
  });

  it("shows complete payout evidence and only real recorded history", () => {
    render(<PayoutDetail payout={payout} onClose={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: payout.payout_number }),
    ).toHaveAccessibleDescription("Seller A");
    expect(
      screen.getByText("123,456,789,012,345,678.90 NPR"),
    ).toBeInTheDocument();
    expect(screen.getByText(payout.notes)).toBeInTheDocument();
    expect(screen.getByText(payout.rejection_reason)).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("list", { name: "Recorded payout events" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(2);
    expect(screen.queryByText("Disbursement recorded")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("shows review evidence and a response without fabricating its missing date", () => {
    render(
      <ReviewDetail
        review={{
          id: payout.id,
          product: { id: payout.id, name: "Apples" },
          customer: { id: user.id, email: user.email },
          rating: 4,
          title: "Fresh produce",
          body: "Delivered as ordered",
          status: "published",
          verified_purchase: true,
          seller_response: "Thank you",
          seller_response_at: null,
          created_at: payout.created_at,
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("4 out of 5")).toBeInTheDocument();
    expect(screen.getByText("Delivered as ordered")).toBeInTheDocument();
    expect(screen.getByText("Thank you")).toBeInTheDocument();
    const history = screen.getByRole("list", {
      name: "Recorded review events",
    });
    expect(history.querySelectorAll("time")).toHaveLength(1);
  });

  it("loads order-specific records on demand and respects separate read permissions", async () => {
    const fetch = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Response
    >(() => json({ count: 0, next: null, previous: null, results: [] }));
    vi.stubGlobal("fetch", fetch);
    render(
      <RelatedOrderWork
        sellerId={membership.seller.id}
        orderId={payout.id}
        canReadShipments
        canReadReturns={false}
      />,
    );
    expect(fetch).not.toHaveBeenCalled();
    const disclosure = screen
      .getByText("Related fulfillment and after-sales records")
      .closest("details")!;
    disclosure.open = true;
    fireEvent(disclosure, new Event("toggle"));
    expect(
      await screen.findByText("No shipments recorded for this order."),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toContain(`seller_order_id=${payout.id}`);
    expect(new Headers(request?.headers).get("X-Seller-ID")).toBe(
      membership.seller.id,
    );
    expect(
      screen.queryByRole("heading", { name: "Returns" }),
    ).not.toBeInTheDocument();
  });

  it("keeps rejected related reads visible rather than replacing them with an empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => json({ detail: "Related records are unavailable." }, 403)),
    );
    render(
      <RelatedOrderWork
        sellerId={membership.seller.id}
        orderId={payout.id}
        canReadShipments
        canReadReturns={false}
      />,
    );
    const disclosure = screen
      .getByText("Related fulfillment and after-sales records")
      .closest("details")!;
    disclosure.open = true;
    fireEvent(disclosure, new Event("toggle"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Related records are unavailable.",
    );
    expect(
      screen.queryByText("No shipments recorded for this order."),
    ).not.toBeInTheDocument();
  });

  it("applies seller payout links from the URL and restores filters on history changes", async () => {
    window.history.replaceState(
      null,
      "",
      `/admin/finance/payouts?seller_id=${membership.seller.id}`,
    );
    const fetch = vi.fn((input: RequestInfo | URL) =>
      String(input).includes("/auth/me")
        ? json({ ...user, platform_permissions: ["platform.finance.read"] })
        : json({ count: 0, next: null, previous: null, results: [] }),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <AuthProvider>
        <AdminPayouts />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([url]) =>
          String(url).includes(
            `/admin/finance/payouts?page=1&seller_id=${membership.seller.id}`,
          ),
        ),
      ).toBe(true),
    );
    expect(screen.getByRole("textbox", { name: "Seller ID" })).toHaveValue(
      membership.seller.id,
    );
    act(() => {
      window.history.replaceState(null, "", "/admin/finance/payouts");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("textbox", { name: "Seller ID" })).toHaveValue("");
  });

  it("keeps seller financial and related workspace access behind explicit platform capabilities", async () => {
    const seller = {
      ...membership.seller,
      legal_name: "Seller A Legal",
      email: "business@example.com",
      phone: "",
      created_at: payout.created_at,
      updated_at: payout.created_at,
      approved_at: null,
      approved_by: null,
      profile: { description: "", website: "" },
      settings: { support_email: "" },
      addresses: [],
    };
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/me"))
        return json({
          ...user,
          platform_permissions: ["platform.sellers.read"],
        });
      if (url.endsWith(`/admin/sellers/${seller.id}`)) return json(seller);
      return json({ count: 0, next: null, previous: null, results: [] });
    });
    vi.stubGlobal("fetch", fetch);
    render(
      <AuthProvider>
        <PlatformSellerDetail sellerId={seller.id} />
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Business profile" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Financial summary" }),
    ).not.toBeInTheDocument();
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes("/finance/")),
    ).toBe(false);
    expect(
      screen.queryByRole("link", { name: "Platform catalog" }),
    ).not.toBeInTheDocument();
  });
});
