import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { SellerOrders } from "@/features/orders/seller-orders";
import { SellerOrderDetailView } from "@/features/orders/seller-order-detail";
import { AdminOrders } from "@/features/orders/admin-orders";
import { AdminOrderDetailView } from "@/features/orders/admin-order-detail";
import {
  type SellerOrderSummary,
  type SellerOrderDetail,
  type PlatformOrderSummary,
  type PlatformOrderDetail,
} from "@/features/orders/api";
import { csrf, json, membership, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/orders",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const sellerOrderSummaryA: SellerOrderSummary = {
  id: "f1000000-0000-4000-8000-000000000001",
  order_id: "f2000000-0000-4000-8000-000000000001",
  order_number: "ORD-123456",
  seller_order_number: "SO-ORD-123456-SELLER",
  currency: "NPR",
  subtotal: "300.00",
  discount_total: "0.00",
  tax_total: "30.00",
  shipping_total: "0.00",
  commission_total: "10.00",
  seller_net_total: "320.00",
  status: "pending",
  items_count: 2,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};

const sellerOrderDetailA: SellerOrderDetail = {
  ...sellerOrderSummaryA,
  customer_email: "buyer@example.com",
  shipping_address_snapshot: { city: "Kathmandu", country: "NP" },
  billing_address_snapshot: { city: "Kathmandu", country: "NP" },
  items: [
    {
      id: "f3000000-0000-4000-8000-000000000001",
      product_id: "f4000000-0000-4000-8000-000000000001",
      variant_id: "f5000000-0000-4000-8000-000000000001",
      warehouse_id: "f6000000-0000-4000-8000-000000000001",
      product_name_snapshot: "Fresh Organic Apple",
      sku_snapshot: "APPLE-ORG",
      variant_snapshot: { sku: "APPLE-ORG" },
      quantity: 2,
      unit_price: "150.00",
      discount_amount: "0.00",
      tax_amount: "15.00",
      total: "315.00",
      commission_amount: "10.00",
      seller_net_amount: "305.00",
    },
  ],
  status_history: [
    {
      id: "f7000000-0000-4000-8000-000000000001",
      actor_id: null,
      from_status: "none",
      to_status: "pending",
      notes: "Order placed by customer.",
      created_at: "2026-10-01T12:00:00Z",
    },
  ],
};

const platformOrderSummaryA: PlatformOrderSummary = {
  id: "f2000000-0000-4000-8000-000000000001",
  order_number: "ORD-123456",
  customer_email: "buyer@example.com",
  currency: "NPR",
  subtotal: "500.00",
  discount_total: "0.00",
  tax_total: "50.00",
  shipping_total: "0.00",
  grand_total: "550.00",
  payment_status: "paid",
  fulfillment_status: "unfulfilled",
  seller_orders_count: 2,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};

const platformOrderDetailA: PlatformOrderDetail = {
  ...platformOrderSummaryA,
  customer_id: null,
  billing_address_snapshot: { city: "Kathmandu" },
  shipping_address_snapshot: { city: "Kathmandu" },
  seller_orders: [
    {
      id: "f1000000-0000-4000-8000-000000000001",
      seller_id: membership.seller.id,
      seller_name: "Apex Trading",
      seller_order_number: "SO-ORD-123456-SELLER",
      subtotal: "300.00",
      discount_total: "0.00",
      tax_total: "30.00",
      shipping_total: "0.00",
      commission_total: "10.00",
      seller_net_total: "320.00",
      status: "pending",
      items: sellerOrderDetailA.items,
      status_history: sellerOrderDetailA.status_history,
      created_at: "2026-10-01T12:00:00Z",
      updated_at: "2026-10-01T12:00:00Z",
    },
  ],
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Orders UI and permissions", () => {
  it("renders seller orders list when authorized", async () => {
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
        if (url.includes(`/api/v1/seller/access`))
          return json({
            ...membership,
            permissions: ["orders.read", "orders.update", "orders.cancel"],
          });
        if (url.includes("/api/v1/seller/orders/")) {
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [sellerOrderSummaryA],
          });
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerOrders />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("SO-ORD-123456-SELLER")).toBeInTheDocument();
    });

    expect(screen.getByText("Parent: ORD-123456")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("denies access to seller orders when lacking orders.read permission", async () => {
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
        if (url.includes(`/api/v1/seller/access`))
          return json({
            ...membership,
            permissions: ["catalog.product.read"], // lacks orders.read
          });
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerOrders />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("You don’t have access")).toBeInTheDocument();
    });
  });

  it("renders seller order detail and performs confirm action", async () => {
    let orderState: SellerOrderDetail = {
      ...sellerOrderDetailA,
      status: "pending",
    };

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
        if (url.includes(`/api/v1/seller/access`))
          return json({
            ...membership,
            permissions: ["orders.read", "orders.update", "orders.cancel"],
          });
        if (url.endsWith(`/confirm/`) && init?.method === "POST") {
          orderState = { ...orderState, status: "confirmed" };
          return json(orderState);
        }
        if (url.includes(`/api/v1/seller/orders/${sellerOrderDetailA.id}/`)) {
          return json(orderState);
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerOrderDetailView orderId={sellerOrderDetailA.id} />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Fresh Organic Apple")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: "Confirm Order" });
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Begin Processing")).toBeInTheDocument();
    });
  });

  it("allows shipping an order with carrier and tracking", async () => {
    let orderState: SellerOrderDetail = {
      ...sellerOrderDetailA,
      status: "processing",
    };

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
        if (url.includes(`/api/v1/seller/access`))
          return json({
            ...membership,
            permissions: ["orders.read", "orders.update"],
          });
        if (url.endsWith(`/ship/`) && init?.method === "POST") {
          orderState = { ...orderState, status: "shipped" };
          return json(orderState);
        }
        if (url.includes(`/api/v1/seller/orders/${sellerOrderDetailA.id}/`)) {
          return json(orderState);
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerOrderDetailView orderId={sellerOrderDetailA.id} />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Ship Order" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ship Order" }));

    expect(screen.getByText("Fulfill & Ship Order")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Carrier name"), {
      target: { value: "DHL Express" },
    });
    fireEvent.change(screen.getByPlaceholderText("Tracking code"), {
      target: { value: "DHL-987654" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Shipment" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark Delivered" }),
      ).toBeInTheDocument();
    });
  });

  it("allows cancelling an order with a reason", async () => {
    let orderState: SellerOrderDetail = {
      ...sellerOrderDetailA,
      status: "pending",
    };

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
        if (url.includes(`/api/v1/seller/access`))
          return json({
            ...membership,
            permissions: ["orders.read", "orders.cancel"],
          });
        if (url.endsWith(`/cancel/`) && init?.method === "POST") {
          orderState = { ...orderState, status: "cancelled" };
          return json(orderState);
        }
        if (url.includes(`/api/v1/seller/orders/${sellerOrderDetailA.id}/`)) {
          return json(orderState);
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerOrderDetailView orderId={sellerOrderDetailA.id} />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel Order" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel Order" }));

    expect(screen.getByText("Cancellation Reason *")).toBeInTheDocument();
    fireEvent.change(
      screen.getByPlaceholderText(
        "Explain why this order is being cancelled...",
      ),
      {
        target: { value: "Buyer requested cancellation" },
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm Cancellation" }),
    );

    await waitFor(() => {
      expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    });
  });

  it("renders platform orders list for platform admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({
            ...user,
            platform_permissions: ["platform.orders.read"],
          });
        if (url.includes("/api/v1/admin/orders/")) {
          return json({
            count: 1,
            next: null,
            previous: null,
            page: 1,
            results: [platformOrderSummaryA],
          });
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <AdminOrders />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("ORD-123456")).toBeInTheDocument();
    });

    expect(screen.getByText("buyer@example.com")).toBeInTheDocument();
    expect(screen.getByText("2 sellers")).toBeInTheDocument();
  });

  it("renders platform order detail showing multi-seller breakdown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me"))
          return json({
            ...user,
            platform_permissions: ["platform.orders.read"],
          });
        if (url.includes(`/api/v1/admin/orders/${platformOrderDetailA.id}/`)) {
          return json(platformOrderDetailA);
        }
        return json({ detail: "Not found" }, 404);
      }),
    );

    render(
      <AuthProvider>
        <AdminOrderDetailView orderId={platformOrderDetailA.id} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Order ORD-123456")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Apex Trading (SO-ORD-123456-SELLER)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fresh Organic Apple")).toBeInTheDocument();
  });
});
