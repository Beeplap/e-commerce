import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { SellerShipments } from "@/features/fulfillment/seller-shipments";
import { SellerReturns } from "@/features/fulfillment/seller-returns";
import { SellerRefunds } from "@/features/fulfillment/seller-refunds";
import { AdminFulfillmentOverview } from "@/features/fulfillment/admin-fulfillment";
import type {
  Shipment,
  ReturnRequest,
  Refund,
} from "@/features/fulfillment/api";
import { csrf, json, membership, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/shipments",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockShipment: Shipment = {
  id: "e1000000-0000-4000-8000-000000000001",
  shipment_number: "SHP-001234",
  seller_id: membership.seller.id,
  seller_name: "Seller A",
  seller_order_id: "f1000000-0000-4000-8000-000000000001",
  seller_order_number: "SO-1234",
  shipping_method_id: null,
  carrier: "FedEx",
  tracking_number: "TRK-987654",
  tracking_url: "https://fedex.com/track/TRK-987654",
  status: "in_transit",
  shipped_at: "2026-10-02T10:00:00Z",
  delivered_at: null,
  estimated_delivery_at: "2026-10-04T18:00:00Z",
  shipping_label_url: "",
  notes: "Handle with care",
  items: [
    {
      id: "e2000000-0000-4000-8000-000000000001",
      order_item_id: "e3000000-0000-4000-8000-000000000001",
      sku_snapshot: "SKU-PROD-1",
      product_name_snapshot: "Organic Green Apples",
      quantity: 2,
      created_at: "2026-10-02T10:00:00Z",
    },
  ],
  tracking_events: [
    {
      id: "e4000000-0000-4000-8000-000000000001",
      status: "in_transit",
      location: "Denver Hub",
      description: "Package departed local sorting center.",
      timestamp: "2026-10-02T10:30:00Z",
      created_at: "2026-10-02T10:30:00Z",
    },
  ],
  created_at: "2026-10-02T09:00:00Z",
  updated_at: "2026-10-02T10:30:00Z",
};

const mockReturn: ReturnRequest = {
  id: "d1000000-0000-4000-8000-000000000001",
  return_number: "RET-001234",
  seller_id: membership.seller.id,
  seller_name: "Seller A",
  seller_order_id: "f1000000-0000-4000-8000-000000000001",
  seller_order_number: "SO-1234",
  customer_id: null,
  customer_email: "buyer@example.com",
  status: "requested",
  reason: "defective",
  customer_notes: "Item arrived crushed in shipment box.",
  rejection_reason: "",
  return_tracking_number: "",
  return_carrier: "",
  requested_at: "2026-10-02T11:00:00Z",
  approved_at: null,
  received_at: null,
  closed_at: null,
  items: [
    {
      id: "d2000000-0000-4000-8000-000000000001",
      order_item_id: "e3000000-0000-4000-8000-000000000001",
      sku_snapshot: "SKU-PROD-1",
      product_name_snapshot: "Organic Green Apples",
      quantity: 1,
      reason: "defective",
      condition: "damaged",
      restock_inventory: false,
      warehouse_id: null,
      refund_amount: "50.00",
    },
  ],
  status_history: [
    {
      id: "d3000000-0000-4000-8000-000000000001",
      actor_id: null,
      from_status: "none",
      to_status: "requested",
      notes: "Customer requested return.",
      created_at: "2026-10-02T11:00:00Z",
    },
  ],
  created_at: "2026-10-02T11:00:00Z",
  updated_at: "2026-10-02T11:00:00Z",
};

const mockRefund: Refund = {
  id: "c1000000-0000-4000-8000-000000000001",
  refund_number: "REF-001234",
  seller_id: membership.seller.id,
  seller_name: "Seller A",
  seller_order_id: "f1000000-0000-4000-8000-000000000001",
  seller_order_number: "SO-1234",
  return_request_id: mockReturn.id,
  amount: "50.00",
  currency: "USD",
  status: "completed",
  reason: "Defective item refunded after inspection.",
  commission_reversed: "5.00",
  seller_deduction: "45.00",
  created_by_id: user.id,
  transactions: [
    {
      id: "c2000000-0000-4000-8000-000000000001",
      transaction_type: "refund",
      amount: "50.00",
      gateway_reference: "gw_ref_123456",
      status: "succeeded",
      raw_response: {},
      created_at: "2026-10-02T11:30:00Z",
    },
  ],
  created_at: "2026-10-02T11:30:00Z",
  completed_at: "2026-10-02T11:30:00Z",
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Fulfillment, Returns, and Refunds UI", () => {
  it("renders seller shipments list and shows details modal", async () => {
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
            permissions: ["fulfillment.read", "fulfillment.manage"],
          });
        if (url.includes("/api/v1/seller/fulfillment/shipments")) {
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [mockShipment],
          });
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerShipments />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("SHP-001234")).toBeInTheDocument();
    });

    expect(screen.getByText("FedEx")).toBeInTheDocument();
    expect(screen.getByText("TRK-987654")).toBeInTheDocument();

    // Click "Inspect" to open the shipment inspection modal
    fireEvent.click(screen.getByText("Inspect"));

    await waitFor(() => {
      expect(screen.getByText("Organic Green Apples")).toBeInTheDocument();
    });
    expect(screen.getByText("x2")).toBeInTheDocument();
    expect(
      screen.getByText("Package departed local sorting center."),
    ).toBeInTheDocument();
  });

  it("denies access to shipments when lacking fulfillment.read", async () => {
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
            permissions: ["seller.context.read"],
          });
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerShipments />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("You don’t have access")).toBeInTheDocument();
    });
  });

  it("renders seller returns list and allows approving return", async () => {
    let approved = false;
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
            permissions: ["returns.read", "returns.manage"],
          });
        if (
          url.includes(
            `/api/v1/seller/fulfillment/returns/${mockReturn.id}/approve`,
          )
        ) {
          approved = true;
          return json({ ...mockReturn, status: "approved" });
        }
        if (url.includes("/api/v1/seller/fulfillment/returns")) {
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [
              approved ? { ...mockReturn, status: "approved" } : mockReturn,
            ],
          });
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerReturns />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("RET-001234")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Inspect & Process"));

    await waitFor(() => {
      expect(screen.getByText("Approve Return")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Approve Return"));

    await waitFor(() => {
      expect(approved).toBe(true);
    });
  });

  it("renders seller refunds list and allows creating a refund", async () => {
    let createdRefund = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
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
            permissions: ["returns.read", "returns.manage", "finance.read"],
          });
        if (
          method === "POST" &&
          url.includes("/api/v1/seller/fulfillment/refunds")
        ) {
          createdRefund = true;
          return json(mockRefund, 201);
        }
        if (url.includes("/api/v1/seller/fulfillment/refunds")) {
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [mockRefund],
          });
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerRefunds />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("REF-001234")).toBeInTheDocument();
    });

    // Click "Issue Refund" button
    fireEvent.click(screen.getByText("Issue Refund"));

    // Fill in modal inputs
    fireEvent.change(screen.getByPlaceholderText("UUID of order to refund"), {
      target: { value: "f1000000-0000-4000-8000-000000000001" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "50.00" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "e.g. Return received, defective item concession",
      ),
      {
        target: { value: "Defective item return" },
      },
    );

    // Submit form
    fireEvent.click(screen.getByText("Confirm Refund"));

    await waitFor(() => {
      expect(createdRefund).toBe(true);
    });
  });

  it("renders platform fulfillment admin overview with tabs and allows platform refund", async () => {
    let platformRefundIssued = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({
            ...user,
            platform_permissions: [
              "platform.fulfillment.read",
              "platform.refunds.manage",
            ],
          });
        if (
          method === "POST" &&
          url.includes("/api/v1/admin/fulfillment/refunds")
        ) {
          platformRefundIssued = true;
          return json(mockRefund, 201);
        }
        if (url.includes("/api/v1/admin/fulfillment/shipments")) {
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [mockShipment],
          });
        }
        if (url.includes("/api/v1/admin/fulfillment/returns")) {
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [mockReturn],
          });
        }
        if (url.includes("/api/v1/admin/fulfillment/refunds")) {
          return json({
            count: 1,
            next: null,
            previous: null,
            results: [mockRefund],
          });
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <AdminFulfillmentOverview />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Marketplace Fulfillment & Logistics"),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("SHP-001234")).toBeInTheDocument();
    });

    // Switch to returns tab
    fireEvent.click(screen.getByText("Returns"));
    await waitFor(() => {
      expect(screen.getByText("RET-001234")).toBeInTheDocument();
    });

    // Switch to refunds tab
    fireEvent.click(screen.getByText("Refunds"));
    await waitFor(() => {
      expect(screen.getByText("REF-001234")).toBeInTheDocument();
    });

    // Open Platform Refund modal
    fireEvent.click(screen.getByText("Platform Refund"));

    fireEvent.change(screen.getByPlaceholderText("UUID of order to refund"), {
      target: { value: "f1000000-0000-4000-8000-000000000001" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "25.00" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("e.g. Administrative customer concession"),
      {
        target: { value: "Customer satisfaction credit" },
      },
    );

    fireEvent.click(screen.getByText("Confirm Refund"));

    await waitFor(() => {
      expect(platformRefundIssued).toBe(true);
    });
  });
});
