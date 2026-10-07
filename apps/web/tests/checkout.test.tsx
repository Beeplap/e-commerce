import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutSessionProvider } from "@/features/checkout/session";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-context";
import CheckoutPage from "@/app/checkout/page";
import CheckoutSuccessPage from "@/app/checkout/success/page";
import { csrf, json, user } from "./fixtures";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/checkout",
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

import {
  mockCart,
  mockAddresses,
  mockQuote,
  mockPlacedOrder,
  mockOrder,
} from "./checkout-fixtures";
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
          <CheckoutSessionProvider>
            <CheckoutPage />
          </CheckoutSessionProvider>
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
    expect(screen.getAllByText(/^5\.00\sUSD$/).length).toBeGreaterThanOrEqual(
      1,
    );

    // Verify summary totals
    expect(screen.getByTestId("checkout-summary-subtotal").textContent).toBe(
      "50.00\u00a0USD",
    );
    expect(screen.getByTestId("checkout-summary-shipping").textContent).toBe(
      "5.00\u00a0USD",
    );
    expect(screen.getByTestId("checkout-summary-total").textContent).toBe(
      "55.00\u00a0USD",
    );
  });

  it("allows selecting alternative shipping method per seller", async () => {
    global.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
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
          const body = JSON.parse(String(init?.body));
          if (
            body.shipping_selections?.[mockQuote.sellers[0]!.seller_id] ===
            mockQuote.sellers[0]!.available_shipping_methods[1]!.method_id
          )
            return json({
              ...mockQuote,
              shipping_total: "15.00",
              grand_total: "65.00",
              sellers: [
                {
                  ...mockQuote.sellers[0],
                  shipping_fee: "15.00",
                  total: "65.00",
                  selected_shipping_method:
                    mockQuote.sellers[0]!.available_shipping_methods[1],
                },
              ],
            });
          return json(mockQuote);
        }
        return json({});
      },
    );

    render(
      <AuthProvider>
        <CartProvider>
          <CheckoutSessionProvider>
            <CheckoutPage />
          </CheckoutSessionProvider>
        </CartProvider>
      </AuthProvider>,
    );

    const el = await screen.findByText("Acme Priority Express");
    const expressRadio = el.closest("label")!.querySelector("input")!;
    fireEvent.click(expressRadio);

    await waitFor(() => {
      expect(
        screen.getByRole("radio", { name: /Acme Priority Express/ }),
      ).toBeChecked();
      expect(screen.getByTestId("checkout-summary-total")).toHaveTextContent(
        /65.00\sUSD/,
      );
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
          <CheckoutSessionProvider>
            <CheckoutPage />
          </CheckoutSessionProvider>
        </CartProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText("Seller: Acme Tech")).toBeDefined();
    const submitBtn = await screen.findByRole("button", {
      name: /confirm & place order/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/checkout/pay?order_id=50000000-0000-4000-8000-000000000001",
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
        return json(user);
      }
      if (url.includes("/api/v1/storefront/categories")) {
        return json([]);
      }
      if (url.includes("/api/v1/customer/orders/")) return json(mockOrder);
      if (url.includes("/api/v1/cart/")) {
        return json(mockCart);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CheckoutSessionProvider>
            <CheckoutSuccessPage />
          </CheckoutSessionProvider>
        </CartProvider>
      </AuthProvider>,
    );

    // Verify confirmation elements
    expect(await screen.findByText(/Your order is confirmed/i)).toBeDefined();
    expect(screen.getByTestId("success-order-number").textContent).toBe(
      "ORD-98765432",
    );
    expect(screen.getByText(/^55\.00\sUSD$/)).toBeDefined();
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();

    // Verify action links
    expect(
      screen.getByRole("link", { name: /view your order/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: /continue shopping/i }),
    ).toBeDefined();
  });
});
