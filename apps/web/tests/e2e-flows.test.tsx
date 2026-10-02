import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { LoginForm } from "@/features/auth/login-form";
import { AccountMenu } from "@/features/auth/account-menu";
import { AdminWorkspace } from "@/features/workspaces/admin-workspace";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { PlatformSellerDetail } from "@/features/sellers/platform-detail";
import { CreateProduct } from "@/features/catalog/product-form";
import { SellerProductDetail } from "@/features/catalog/product-detail";
import { SellerInventoryAdjustments } from "@/features/inventory/adjustments";
import { SellerOrderDetailView } from "@/features/orders/seller-order-detail";
import { SellerFinanceOverview } from "@/features/finance/seller-finance-overview";
import { csrf, json, membership, user } from "./fixtures";

const navigation = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  pathname: "/seller",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

beforeEach(() => {
  navigation.pathname = "/seller";
  navigation.router.replace.mockReset();
  navigation.router.push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const adminUser = {
  ...user,
  platform_permissions: [
    "platform.access",
    "platform.sellers.read",
    "platform.sellers.manage",
  ],
};

const fullSellerMembership = {
  ...membership,
  permissions: [
    "seller.context.read",
    "seller.settings.read",
    "seller.settings.update",
    "seller.ownership.manage",
    "staff.read",
    "staff.invite",
    "staff.update",
    "staff.remove",
    "catalog.product.read",
    "catalog.product.create",
    "catalog.product.update",
    "catalog.product.archive",
    "inventory.read",
    "inventory.adjust",
    "orders.read",
    "orders.update",
    "orders.cancel",
    "finance.read",
    "payouts.read",
    "analytics.read",
  ],
};

const pendingSellerDetail = {
  id: "30000000-0000-4000-8000-000000000001",
  legal_name: "Alpha Legal",
  display_name: "Alpha Store",
  slug: "alpha-store",
  status: "pending",
  verification_status: "verified",
  email: "contact@alpha.com",
  phone: "+123456789",
  default_currency: "USD",
  timezone: "UTC",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  approved_at: null,
  approved_by: null,
  profile: { description: "Great store", website: "https://alpha.com" },
  settings: { support_email: "support@alpha.com" },
  addresses: [],
};

const sampleCategory = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Phones",
  slug: "phones",
  parent_id: null,
  description: "Smartphones",
  sort_order: 1,
  is_active: true,
};

const sampleProduct = {
  id: "50000000-0000-4000-8000-000000000001",
  seller_id: membership.seller.id,
  category: sampleCategory,
  brand: null,
  name: "Super Phone",
  slug: "super-phone",
  short_description: "Flagship phone",
  description: "Detailed description of Super Phone",
  status: "draft" as const,
  currency: "USD",
  created_by_id: user.id,
  approved_by_id: null,
  approved_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const sampleOrder = {
  id: "f1000000-0000-4000-8000-000000000001",
  order_id: "f2000000-0000-4000-8000-000000000001",
  order_number: "ORD-123456",
  seller_order_number: "SO-1001",
  currency: "USD",
  subtotal: "100.00",
  discount_total: "0.00",
  tax_total: "10.00",
  shipping_total: "0.00",
  commission_total: "10.00",
  seller_net_total: "100.00",
  status: "pending" as const,
  items_count: 1,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
  customer_email: "buyer@example.com",
  shipping_address_snapshot: { city: "Kathmandu", country: "NP" },
  billing_address_snapshot: { city: "Kathmandu", country: "NP" },
  items: [
    {
      id: "f3000000-0000-4000-8000-000000000001",
      product_id: "50000000-0000-4000-8000-000000000001",
      variant_id: "f5000000-0000-4000-8000-000000000001",
      warehouse_id: "f6000000-0000-4000-8000-000000000001",
      product_name_snapshot: "Super Phone",
      sku_snapshot: "SKU-SP-01",
      variant_snapshot: { sku: "SKU-SP-01" },
      quantity: 1,
      unit_price: "100.00",
      discount_amount: "0.00",
      tax_amount: "10.00",
      total: "110.00",
      commission_amount: "10.00",
      seller_net_amount: "100.00",
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

function defaultFetchHandler(input: RequestInfo | URL) {
  const url = String(input);
  if (url.includes("/api/v1/auth/csrf")) return json({ csrf_token: csrf });
  if (url.includes("/api/v1/auth/me")) return json(user);
  if (url.includes("/api/v1/seller/memberships"))
    return json({
      count: 1,
      next: null,
      previous: null,
      results: [fullSellerMembership],
    });
  if (url.includes("/api/v1/seller/access")) return json(fullSellerMembership);
  if (url.includes("/seller/catalog/categories"))
    return json({
      count: 1,
      next: null,
      previous: null,
      results: [sampleCategory],
    });
  if (url.includes("/seller/catalog/brands"))
    return json({ count: 0, next: null, previous: null, results: [] });
  if (
    url.includes("/seller/catalog/attributes") ||
    url.includes("/seller/catalog/category-attributes")
  )
    return json({ count: 0, next: null, previous: null, results: [] });
  return null;
}

describe("Phase 13 End-to-End High-Value Flows", () => {
  it("Flow 1: Super Admin login grants platform access", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/csrf")) return json({ csrf_token: csrf });
      if (url.includes("/api/v1/auth/login")) return json(adminUser);
      if (
        url.includes("/api/v1/auth/me") ||
        url.includes("/api/v1/admin/access")
      )
        return json(adminUser);
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByLabelText(/Email address/), {
      target: { value: adminUser.email },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: "AdminPassword123!" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign in" }).closest("form")!,
    );

    await waitFor(() => {
      expect(navigation.router.replace).toHaveBeenCalledWith("/workspaces");
    });
  });

  it("Flow 2: Super Admin approves pending seller", async () => {
    let sellerStatus = "pending";
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, opts?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (
          url.includes("/api/v1/auth/me") ||
          url.includes("/api/v1/admin/access")
        )
          return json(adminUser);
        if (
          url.includes(
            `/api/v1/admin/sellers/${pendingSellerDetail.id}/approve`,
          ) &&
          opts?.method === "POST"
        ) {
          sellerStatus = "active";
          return json({ ...pendingSellerDetail, status: "active" });
        }
        if (url.includes(`/api/v1/admin/sellers/${pendingSellerDetail.id}`)) {
          return json({ ...pendingSellerDetail, status: sellerStatus });
        }
        if (
          url.includes("/documents") ||
          url.includes("/history") ||
          url.includes("/audit") ||
          url.includes("/members")
        ) {
          return json({ count: 0, next: null, previous: null, results: [] });
        }
        return json({}, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <PlatformSellerDetail sellerId={pendingSellerDetail.id} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha Store")).toBeInTheDocument();
    });

    const approveButton = screen.getByRole("button", {
      name: /approve seller/i,
    });
    fireEvent.click(approveButton);

    const confirmButton = screen.getByRole("button", {
      name: /confirm action/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/approve"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("Flow 3: Seller owner login and workspace access", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const handled = defaultFetchHandler(input);
      if (handled) return handled;
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <SellerWorkspace>
          <h1>Seller Dashboard Loaded</h1>
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Seller Dashboard Loaded")).toBeInTheDocument();
    });
  });

  it("Flow 4: Seller creates a product", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, opts?: RequestInit) => {
        const handled = defaultFetchHandler(input);
        if (handled) return handled;
        const url = String(input);
        if (url.includes("/seller/products") && opts?.method === "POST") {
          return json(sampleProduct, 201);
        }
        return json({}, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <SellerWorkspace>
          <CreateProduct />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Product name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Product name/i), {
      target: { value: "Super Phone" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^Category$/i }), {
      target: { value: sampleCategory.id },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /create draft/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/seller/products"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("Flow 5: Seller views product detail and variants", async () => {
    const variants = [
      {
        id: "a1000000-0000-4000-8000-000000000001",
        product_id: sampleProduct.id,
        sku: "SKU-SP-01",
        barcode: "1234567890",
        price: "499.00",
        compare_at_price: null,
        cost_price: null,
        weight: null,
        length: null,
        width: null,
        height: null,
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const handled = defaultFetchHandler(input);
      if (handled) return handled;
      const url = String(input);
      if (url.includes(`/seller/products/${sampleProduct.id}/variants`)) {
        return json({
          count: 1,
          next: null,
          previous: null,
          results: variants,
        });
      }
      if (url.includes(`/seller/products/${sampleProduct.id}/images`)) {
        return json({ count: 0, next: null, previous: null, results: [] });
      }
      if (url.includes(`/seller/products/${sampleProduct.id}/history`)) {
        return json({ count: 0, next: null, previous: null, results: [] });
      }
      if (url.includes(`/seller/products/${sampleProduct.id}/attributes`)) {
        return json([]);
      }
      if (url.includes(`/seller/products/${sampleProduct.id}`)) {
        return json(sampleProduct);
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerProductDetail productId={sampleProduct.id} />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Super Phone")).toBeInTheDocument();
      expect(screen.getByText("SKU-SP-01")).toBeInTheDocument();
    });
  });

  it("Flow 6: Seller views inventory adjustments", async () => {
    const transactions = [
      {
        id: "e2000000-0000-4000-8000-000000000001",
        inventory_id: "e3000000-0000-4000-8000-000000000001",
        type: "adjustment",
        quantity_delta: 50,
        reference_type: "",
        reference_id: "",
        reason: "Restocked fresh inventory",
        created_by_id: user.id,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const handled = defaultFetchHandler(input);
      if (handled) return handled;
      const url = String(input);
      if (url.includes("/seller/inventory/transactions"))
        return json({
          count: 1,
          next: null,
          previous: null,
          results: transactions,
        });
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerInventoryAdjustments />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Restocked fresh inventory")).toBeInTheDocument();
      expect(screen.getByText("+50")).toBeInTheDocument();
    });
  });

  it("Flow 7 & 8: Seller views order detail and processes confirmation", async () => {
    let orderStatus = "pending";
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, opts?: RequestInit) => {
        const handled = defaultFetchHandler(input);
        if (handled) return handled;
        const url = String(input);
        if (url.includes(`/seller/orders/${sampleOrder.id}`)) {
          if (opts?.method === "POST" && url.includes("/confirm")) {
            orderStatus = "confirmed";
            return json({ ...sampleOrder, status: "confirmed" });
          }
          return json({ ...sampleOrder, status: orderStatus });
        }
        return json({}, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerOrderDetailView orderId={sampleOrder.id} />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("SO-1001")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /confirm order/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/seller/orders/${sampleOrder.id}/confirm`),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("Flow 9: Seller views finance ledger and balances", async () => {
    const balanceData = {
      seller_id: membership.seller.id,
      currency: "USD",
      current_balance: "1500.00",
      pending_balance: "200.00",
      total_paid_out: "500.00",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const handled = defaultFetchHandler(input);
      if (handled) return handled;
      const url = String(input);
      if (url.includes("/seller/finance/balance")) return json(balanceData);
      if (
        url.includes("/seller/finance/transactions") ||
        url.includes("/seller/finance/payouts")
      )
        return json({ count: 0, next: null, previous: null, results: [] });
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerFinanceOverview />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/1,500\.00/)).toBeInTheDocument();
      expect(screen.getByText(/200\.00/)).toBeInTheDocument();
    });
  });

  it("Flow 10: Seller A cannot access Seller B resource (error state)", async () => {
    const foreignOrderId = "70000000-0000-4000-8000-000000000002";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const handled = defaultFetchHandler(input);
      if (handled) return handled;
      const url = String(input);
      if (url.includes(`/seller/orders/${foreignOrderId}`)) {
        return json({ detail: "Not found." }, 404);
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerOrderDetailView orderId={foreignOrderId} />
        </SellerWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Not found.")).toBeInTheDocument();
    });
  });

  it("Flow 11: Normal seller cannot access /admin (ForbiddenScreen)", async () => {
    const regularSellerUser = { ...user, platform_permissions: [] };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/csrf")) return json({ csrf_token: csrf });
      if (url.includes("/api/v1/auth/me")) return json(regularSellerUser);
      if (url.includes("/api/v1/admin/access"))
        return json({ detail: "Forbidden" }, 403);
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AdminWorkspace>
          <h1>Confidential Admin Portal</h1>
        </AdminWorkspace>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(
        screen.queryByText("Confidential Admin Portal"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "You don’t have access" }),
      ).toBeInTheDocument();
    });
  });

  it("Flow 12: Logout invalidates session and redirects to login", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, opts?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf"))
          return json({ csrf_token: csrf });
        if (url.includes("/api/v1/auth/me")) return json(user);
        if (url.includes("/api/v1/auth/logout") && opts?.method === "POST") {
          return new Response(null, { status: 204 });
        }
        return json({}, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AccountMenu />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sign out" }),
      ).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/logout",
        expect.objectContaining({ method: "POST" }),
      );
      expect(navigation.router.replace).toHaveBeenCalledWith("/login");
    });
  });
});
