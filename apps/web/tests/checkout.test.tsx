import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-context";
import CheckoutPage from "@/app/checkout/page";
import CheckoutSuccessPage from "@/app/checkout/success/page";
import type {
  CartItem,
  CartResponse,
  CheckoutQuote,
  CustomerAddress,
  PlacedOrderResult,
} from "@/lib/api/types";
import { csrf, json, user } from "./fixtures";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/checkout",
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const mockItem: CartItem = {
  id: "91000000-0000-4000-8000-000000000001",
  variant_id: "81000000-0000-4000-8000-000000000001",
  product_id: "80000000-0000-4000-8000-000000000001",
  product_title: "Wireless Earbuds Pro",
  product_slug: "wireless-earbuds-pro",
  variant_name: "EARBUDS-BLK",
  sku: "EARBUDS-BLK",
  thumbnail_url: null,
  unit_price: "25.00",
  compare_at_price: null,
  quantity: 2,
  line_subtotal: "50.00",
  available_stock: 10,
  is_available: true,
  stock_warning: null,
};

const mockCart: CartResponse = {
  id: "90000000-0000-4000-8000-000000000001",
  total_items: 2,
  total_unique_items: 1,
  subtotal: "50.00",
  currency: "USD",
  has_out_of_stock_items: false,
  sellers: [
    {
      seller_id: "30000000-0000-4000-8000-000000000001",
      seller_name: "Acme Tech",
      seller_slug: "acme-tech",
      subtotal: "50.00",
      item_count: 2,
      items: [mockItem],
    },
  ],
};

const mockAddresses: CustomerAddress[] = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    full_name: "Alice Smith",
    phone: "+15551234567",
    line1: "123 Main St",
    line2: "Apt 4B",
    city: "Austin",
    state: "TX",
    postal_code: "78701",
    country: "US",
    is_default: true,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "70000000-0000-4000-8000-000000000002",
    full_name: "Alice Work",
    phone: "+15559876543",
    line1: "456 Office Blvd",
    line2: "",
    city: "Austin",
    state: "TX",
    postal_code: "78702",
    country: "US",
    is_default: false,
    created_at: "2026-10-02T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
  },
];

const mockQuote: CheckoutQuote = {
  total_items: 2,
  subtotal: "50.00",
  shipping_total: "5.00",
  discount_total: "0.00",
  tax_total: "0.00",
  grand_total: "55.00",
  currency: "USD",
  coupon: {
    code: null,
    is_valid: false,
    discount_amount: "0.00",
    error_message: null,
  },
  sellers: [
    {
      seller_id: "30000000-0000-4000-8000-000000000001",
      seller_name: "Acme Tech",
      seller_slug: "acme-tech",
      subtotal: "50.00",
      shipping_fee: "5.00",
      discount_amount: "0.00",
      tax_amount: "0.00",
      total: "55.00",
      available_shipping_methods: [
        {
          method_id: "60000000-0000-4000-8000-000000000001",
          name: "Acme Standard Ground",
          carrier: "FedEx",
          code: "standard",
          min_days: 3,
          max_days: 5,
          rate: "5.00",
        },
        {
          method_id: "60000000-0000-4000-8000-000000000002",
          name: "Acme Priority Express",
          carrier: "FedEx",
          code: "express",
          min_days: 1,
          max_days: 2,
          rate: "15.00",
        },
      ],
      selected_shipping_method: {
        method_id: "60000000-0000-4000-8000-000000000001",
        name: "Acme Standard Ground",
        carrier: "FedEx",
        code: "standard",
        min_days: 3,
        max_days: 5,
        rate: "5.00",
      },
      items: [
        {
          item_id: "91000000-0000-4000-8000-000000000001",
          variant_id: "81000000-0000-4000-8000-000000000001",
          product_id: "80000000-0000-4000-8000-000000000001",
          product_title: "Wireless Earbuds Pro",
          sku: "EARBUDS-BLK",
          quantity: 2,
          unit_price: "25.00",
          line_subtotal: "50.00",
          available_stock: 10,
          is_in_stock: true,
        },
      ],
    },
  ],
};

const mockPlacedOrder: PlacedOrderResult = {
  order_id: "50000000-0000-4000-8000-000000000001",
  order_number: "ORD-98765432",
  customer_email: "alice@example.com",
  grand_total: "55.00",
  currency: "USD",
  payment_status: "pending",
  seller_orders: [
    {
      id: "51000000-0000-4000-8000-000000000001",
      seller_order_number: "SO-ORD-98765432-ACME",
      seller_name: "Acme Tech",
      subtotal: "50.00",
      shipping_total: "5.00",
      seller_net_total: "47.50",
    },
  ],
  payment_instructions: {
    status: "pending_payment",
  },
};

describe("Customer Checkout & Multi-Seller Workflow", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mockPush.mockReset();
  });

  it("renders checkout page with saved addresses and multi-seller shipment options for authenticated customer", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/csrf")) {
        return json({ csrf_token: csrf });
      }
      if (url.includes("/api/v1/auth/me")) {
        return json(user);
      }
      if (url.includes("/api/v1/storefront/categories")) {
        return json([]);
      }
      if (url.includes("/api/v1/cart/")) {
        return json(mockCart);
      }
      if (url.includes("/api/v1/checkout/addresses/")) {
        return json(mockAddresses);
      }
      if (url.includes("/api/v1/checkout/quote/")) {
        return json(mockQuote);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      </AuthProvider>,
    );

    // Verify saved address is displayed and selected by default
    expect(await screen.findByText("Alice Smith")).toBeDefined();
    expect(screen.getByText("DEFAULT")).toBeDefined();
    expect(screen.getByText("123 Main St")).toBeDefined();

    // Verify multi-seller shipping options rendered
    expect(await screen.findByText("Seller: Acme Tech")).toBeDefined();
    expect(screen.getByText("Acme Standard Ground")).toBeDefined();
    expect(screen.getAllByText("$5.00").length).toBeGreaterThanOrEqual(1);

    // Verify summary totals
    expect(screen.getByTestId("checkout-summary-subtotal").textContent).toBe(
      "$50.00",
    );
    expect(screen.getByTestId("checkout-summary-shipping").textContent).toBe(
      "$5.00",
    );
    expect(screen.getByTestId("checkout-summary-total").textContent).toBe(
      "$55.00",
    );
  });

  it("allows selecting alternative shipping method per seller", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/csrf")) {
        return json({ csrf_token: csrf });
      }
      if (url.includes("/api/v1/auth/me")) {
        return json(user);
      }
      if (url.includes("/api/v1/storefront/categories")) {
        return json([]);
      }
      if (url.includes("/api/v1/cart/")) {
        return json(mockCart);
      }
      if (url.includes("/api/v1/checkout/addresses/")) {
        return json(mockAddresses);
      }
      if (url.includes("/api/v1/checkout/quote/")) {
        return json(mockQuote);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      </AuthProvider>,
    );

    const el = await screen.findByText("Acme Priority Express");
    const expressRadio = el.closest("label")!.querySelector("input")!;
    fireEvent.click(expressRadio);

    await waitFor(() => {
      expect(expressRadio.checked).toBe(true);
    });
  });

  it("submits order placement and navigates to order confirmation", async () => {
    global.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";

        if (url.includes("/api/v1/auth/csrf")) {
          return json({ csrf_token: csrf });
        }
        if (url.includes("/api/v1/auth/me")) {
          return json(user);
        }
        if (url.includes("/api/v1/storefront/categories")) {
          return json([]);
        }
        if (url.includes("/api/v1/cart/")) {
          return json(mockCart);
        }
        if (url.includes("/api/v1/checkout/addresses/")) {
          return json(mockAddresses);
        }
        if (url.includes("/api/v1/checkout/quote/")) {
          return json(mockQuote);
        }
        if (
          url.includes("/api/v1/checkout/place-order/") &&
          method === "POST"
        ) {
          return json(mockPlacedOrder, 201);
        }
        return json({});
      },
    );

    render(
      <AuthProvider>
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText("Alice Smith")).toBeDefined();
    const submitBtn = await screen.findByRole("button", {
      name: /confirm & place order/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("order_number=ORD-98765432"),
      );
    });
  });

  it("renders order confirmation success page with order details and action links", async () => {
    mockSearchParams = new URLSearchParams({
      order_id: "50000000-0000-4000-8000-000000000001",
      order_number: "ORD-98765432",
      email: "alice@example.com",
      total: "55.00",
      currency: "USD",
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/csrf")) {
        return json({ csrf_token: csrf });
      }
      if (url.includes("/api/v1/auth/me")) {
        return json({ detail: "Not authenticated" }, 401);
      }
      if (url.includes("/api/v1/storefront/categories")) {
        return json([]);
      }
      if (url.includes("/api/v1/cart/")) {
        return json(mockCart);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CheckoutSuccessPage />
        </CartProvider>
      </AuthProvider>,
    );

    // Verify confirmation elements
    expect(await screen.findByText(/Order Confirmed!/i)).toBeDefined();
    expect(screen.getByTestId("success-order-number").textContent).toBe(
      "ORD-98765432",
    );
    expect(screen.getByText("$55.00 USD")).toBeDefined();
    expect(screen.getByText("alice@example.com")).toBeDefined();

    // Verify action links
    expect(
      screen.getByRole("link", { name: /track my orders/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: /continue shopping/i }),
    ).toBeDefined();
  });
});
