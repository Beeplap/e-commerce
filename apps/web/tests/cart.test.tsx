import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { StorefrontHeader } from "@/features/storefront/header";
import CartPage from "@/app/cart/page";
import type {
  CartItem,
  CartResponse,
  CouponValidationResult,
} from "@/lib/api/types";
import { csrf, json } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/cart",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
  unit_price: "29.99",
  compare_at_price: "39.99",
  quantity: 2,
  line_subtotal: "59.98",
  available_stock: 8,
  is_available: true,
  stock_warning: null,
};

const mockCartData: CartResponse = {
  id: "90000000-0000-4000-8000-000000000001",
  total_items: 2,
  total_unique_items: 1,
  subtotal: "59.98",
  currency: "USD",
  has_out_of_stock_items: false,
  sellers: [
    {
      seller_id: "30000000-0000-4000-8000-000000000001",
      seller_name: "Acme Tech",
      seller_slug: "acme-tech",
      subtotal: "59.98",
      item_count: 2,
      items: [mockItem],
    },
  ],
};

const mockOutOfStockCartData: CartResponse = {
  ...mockCartData,
  has_out_of_stock_items: true,
  sellers: [
    {
      seller_id: "30000000-0000-4000-8000-000000000001",
      seller_name: "Acme Tech",
      seller_slug: "acme-tech",
      subtotal: "59.98",
      item_count: 2,
      items: [
        {
          ...mockItem,
          available_stock: 0,
          is_available: false,
          stock_warning: "Out of stock",
        },
      ],
    },
  ],
};

describe("Shopping Cart UI & Real-Time Invariants", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("opens cart drawer and renders live badge count", async () => {
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
        return json(mockCartData);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <StorefrontHeader />
          <CartDrawer />
        </CartProvider>
      </AuthProvider>,
    );

    // Live badge count reflects total items
    const badge = await screen.findByTestId("cart-badge");
    expect(badge.textContent).toBe("2");

    // Drawer is initially not rendered
    expect(screen.queryByLabelText("Shopping Cart Drawer")).toBeNull();

    // Click cart button in header
    const cartButton = screen.getByRole("button", { name: /shopping cart/i });
    fireEvent.click(cartButton);

    // Drawer opens
    const drawer = await screen.findByRole("dialog", {
      name: "Shopping Cart Drawer",
    });
    expect(drawer).toBeDefined();
    expect(screen.getByText("Wireless Earbuds Pro")).toBeDefined();
    expect(screen.getByTestId("cart-drawer-subtotal").textContent).toBe(
      "$59.98",
    );
  });

  it("modifies quantity and updates cart totals dynamically", async () => {
    let currentCart = { ...mockCartData };

    global.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
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
        if (
          url.includes(
            "/api/v1/cart/items/91000000-0000-4000-8000-000000000001/",
          )
        ) {
          if (init?.method === "PATCH") {
            currentCart = {
              ...currentCart,
              total_items: 3,
              subtotal: "89.97",
              sellers: [
                {
                  seller_id: "30000000-0000-4000-8000-000000000001",
                  seller_name: "Acme Tech",
                  seller_slug: "acme-tech",
                  subtotal: "89.97",
                  item_count: 3,
                  items: [
                    {
                      ...mockItem,
                      quantity: 3,
                      line_subtotal: "89.97",
                    },
                  ],
                },
              ],
            };
            return json(currentCart);
          }
        }
        if (url.includes("/api/v1/cart/")) {
          return json(currentCart);
        }
        return json({});
      },
    );

    render(
      <AuthProvider>
        <CartProvider>
          <StorefrontHeader />
          <CartDrawer />
        </CartProvider>
      </AuthProvider>,
    );

    // Open drawer
    const cartBtn = await screen.findByRole("button", {
      name: /shopping cart/i,
    });
    fireEvent.click(cartBtn);

    const increaseBtn = await screen.findByRole("button", {
      name: "Increase quantity",
    });
    fireEvent.click(increaseBtn);

    // Verify subtotal and quantity update
    await waitFor(() => {
      expect(screen.getByTestId("cart-drawer-subtotal").textContent).toBe(
        "$89.97",
      );
    });
  });

  it("disables checkout progression when items are out of stock", async () => {
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
        return json(mockOutOfStockCartData);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CartPage />
        </CartProvider>
      </AuthProvider>,
    );

    // Out of stock warning banner is shown
    expect(await screen.findByText(/checkout is disabled/i)).toBeDefined();
    expect(screen.getByText(/⚠️ Out of stock/i)).toBeDefined();

    // Proceed to Checkout button is disabled
    const checkoutLink = screen.getByRole("link", {
      name: /proceed to checkout/i,
    });
    expect(checkoutLink.getAttribute("aria-disabled")).toBe("true");
    expect(checkoutLink.className).toContain("cursor-not-allowed");
  });

  it("applies promotional coupon code with instant discount preview on cart page", async () => {
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
        return json(mockCartData);
      }
      if (url.includes("/api/v1/promotions/validate")) {
        const result: CouponValidationResult = {
          valid: true,
          discount_amount: "10.00",
          error_message: null,
          coupon: null,
          promotion: null,
        };
        return json(result);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CartPage />
        </CartProvider>
      </AuthProvider>,
    );

    await screen.findByText("Wireless Earbuds Pro");

    // Enter promotional code
    const input = screen.getByPlaceholderText(/enter coupon code/i);
    fireEvent.change(input, { target: { value: "SAVE10" } });

    const form = input.closest("form")!;
    fireEvent.submit(form);

    // Coupon success message and discount line
    expect(
      await screen.findByText(/Coupon applied! Saved \$10\.00/i),
    ).toBeDefined();
    expect(screen.getByText("-$10.00")).toBeDefined();

    // Total reflects 59.98 - 10.00 = 49.98
    expect(screen.getByTestId("cart-summary-total").textContent).toBe("$49.98");
  });

  it("clears entire cart and renders empty state", async () => {
    const emptyCart: CartResponse = {
      id: "90000000-0000-4000-8000-000000000001",
      total_items: 0,
      total_unique_items: 0,
      subtotal: "0.00",
      currency: "USD",
      has_out_of_stock_items: false,
      sellers: [],
    };

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
      if (url.includes("/api/v1/cart/clear/")) {
        return json(emptyCart);
      }
      if (url.includes("/api/v1/cart/")) {
        return json(mockCartData);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CartPage />
        </CartProvider>
      </AuthProvider>,
    );

    await screen.findByText("Wireless Earbuds Pro");

    const clearBtn = screen.getByRole("button", { name: /clear entire cart/i });
    fireEvent.click(clearBtn);

    // Empty state is rendered
    expect(
      await screen.findByText(/your cart is currently empty/i),
    ).toBeDefined();
  });
});
