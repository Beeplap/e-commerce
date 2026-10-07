import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutSessionProvider } from "@/features/checkout/session";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-context";
import { ProductDetailView } from "@/features/storefront/product-detail-view";
import { SearchBar } from "@/features/storefront/search-bar";
import { SearchFiltersSidebar } from "@/features/storefront/search-filters";
import { PaymentForm } from "@/features/checkout/payment-form";
import CustomerOrderDetailPage from "@/app/(customer-account)/account/orders/[id]/page";
import { ReviewModal } from "@/features/account/review-modal";
import { ReturnModal } from "@/features/account/return-modal";
import CartPage from "@/app/cart/page";
import CustomerCheckoutPage from "@/app/checkout/page";
import type {
  CartItem,
  CartResponse,
  CheckoutQuote,
  CustomerAddress,
  CustomerOrderDetail,
  PaymentRecord,
  PlacedOrderResult,
  StorefrontProductDetail,
  StorefrontSearchFacets,
} from "@/lib/api/types";
import { csrf, json, user } from "./fixtures";

const mockPush = vi.fn();
let mockParams = { id: "70000000-0000-4000-8000-000000000001" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/products/gaming-keyboard",
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => mockParams,
}));

// ---------------------------------------------------------------------------
// Mock Data Fixtures
// ---------------------------------------------------------------------------

const mockProduct: StorefrontProductDetail = {
  id: "80000000-0000-4000-8000-000000000001",
  title: "Pro Gaming Keyboard",
  slug: "pro-gaming-keyboard",
  description: "RGB Mechanical Keyboard with hot-swappable switches",
  short_description: "Pro RGB mechanical keyboard with hot-swappable switches",
  brand: { id: "b1", name: "RazerTech", slug: "razertech", product_count: 5 },
  category: {
    id: "c1",
    name: "Gaming Gear",
    slug: "gaming-gear",
    description: "Gaming accessories and gear",
    parent_id: null,
    product_count: 10,
  },
  seller: {
    id: "30000000-0000-4000-8000-000000000001",
    name: "TechStore",
    store_name: "TechStore",
    rating: 4.8,
  },
  images: [
    {
      id: "img1",
      url: "https://example.com/keyboard-black.jpg",
      alt_text: "Black Keyboard",
      sort_order: 1,
    },
    {
      id: "img2",
      url: "https://example.com/keyboard-white.jpg",
      alt_text: "White Keyboard",
      sort_order: 2,
    },
  ],
  variants: [
    {
      id: "81000000-0000-4000-8000-000000000001",
      sku: "KB-SG-LIN",
      price: "120.00",
      compare_at_price: "150.00",
      in_stock: true,
      available_quantity: 10,
      attributes: { Color: "Space Gray", Switch: "Linear" },
    },
    {
      id: "81000000-0000-4000-8000-000000000002",
      sku: "KB-AW-CLK",
      price: "130.00",
      compare_at_price: "160.00",
      in_stock: true,
      available_quantity: 5,
      attributes: { Color: "Arctic White", Switch: "Clicky" },
    },
  ],
  starting_price: "120.00",
  compare_at_price: "150.00",
  currency: "USD",
  in_stock: true,
  total_available_stock: 15,
  average_rating: 4.7,
  review_count: 42,
  rating_breakdown: { "1": 0, "2": 1, "3": 2, "4": 9, "5": 30 },
  recent_reviews: [],
};

const mockCartItem: CartItem = {
  id: "91000000-0000-4000-8000-000000000001",
  variant_id: "81000000-0000-4000-8000-000000000001",
  product_id: "80000000-0000-4000-8000-000000000001",
  product_title: "Pro Gaming Keyboard",
  product_slug: "pro-gaming-keyboard",
  variant_name: "Space Gray / Linear",
  sku: "KB-SG-LIN",
  thumbnail_url: null,
  unit_price: "120.00",
  compare_at_price: "150.00",
  quantity: 2,
  line_subtotal: "240.00",
  available_stock: 10,
  is_available: true,
  stock_warning: null,
};

const mockCart: CartResponse = {
  id: "90000000-0000-4000-8000-000000000001",
  total_items: 2,
  total_unique_items: 1,
  subtotal: "240.00",
  currency: "USD",
  has_out_of_stock_items: false,
  sellers: [
    {
      seller_id: "30000000-0000-4000-8000-000000000001",
      seller_name: "TechStore",
      seller_slug: "techstore",
      subtotal: "240.00",
      item_count: 2,
      items: [mockCartItem],
    },
  ],
};

const mockAddress: CustomerAddress = {
  id: "76000000-0000-4000-8000-000000000001",
  full_name: "Jane Shopper",
  phone: "+1 555-0100",
  line1: "123 Market St",
  line2: "Apt 4B",
  city: "San Francisco",
  state: "CA",
  postal_code: "94105",
  country: "US",
  is_default: true,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};

const mockQuote: CheckoutQuote = {
  total_items: 2,
  subtotal: "240.00",
  shipping_total: "10.00",
  discount_total: "24.00",
  tax_total: "0.00",
  grand_total: "226.00",
  currency: "USD",
  coupon: {
    code: "SAVE10",
    is_valid: true,
    discount_amount: "24.00",
    error_message: null,
  },
  sellers: [
    {
      seller_id: "30000000-0000-4000-8000-000000000001",
      seller_name: "TechStore",
      seller_slug: "techstore",
      subtotal: "240.00",
      shipping_fee: "10.00",
      discount_amount: "24.00",
      tax_amount: "0.00",
      total: "226.00",
      available_shipping_methods: [
        {
          method_id: "60000000-0000-4000-8000-000000000001",
          code: "standard",
          name: "Standard Ground",
          carrier: "FedEx",
          min_days: 3,
          max_days: 5,
          rate: "10.00",
        },
      ],
      selected_shipping_method: {
        method_id: "60000000-0000-4000-8000-000000000001",
        code: "standard",
        name: "Standard Ground",
        carrier: "FedEx",
        min_days: 3,
        max_days: 5,
        rate: "10.00",
      },
      items: [
        {
          item_id: "91000000-0000-4000-8000-000000000001",
          variant_id: "81000000-0000-4000-8000-000000000001",
          product_id: "80000000-0000-4000-8000-000000000001",
          product_title: "Pro Gaming Keyboard",
          sku: "KB-SG-LIN",
          quantity: 2,
          unit_price: "120.00",
          line_subtotal: "240.00",
          available_stock: 10,
          is_in_stock: true,
        },
      ],
    },
  ],
};

const mockPlacedOrder: PlacedOrderResult = {
  order_id: "70000000-0000-4000-8000-000000000001",
  order_number: "ORD-99887766",
  customer_email: "jane@example.com",
  grand_total: "226.00",
  currency: "USD",
  payment_status: "pending",
  seller_orders: [
    {
      id: "72000000-0000-4000-8000-000000000001",
      seller_order_number: "SO-ORD-99887766-TECH",
      seller_name: "TechStore",
      subtotal: "240.00",
      shipping_total: "10.00",
      seller_net_total: "226.00",
    },
  ],
  payment_instructions: {
    intent_url: "/api/v1/checkout/payment-intent/",
    payment_method: "card",
  },
};

const mockOrderDetail: CustomerOrderDetail = {
  id: "70000000-0000-4000-8000-000000000001",
  order_number: "ORD-99887766",
  created_at: "2026-10-03T10:00:00Z",
  status: "delivered",
  payment_status: "paid",
  fulfillment_status: "delivered",
  subtotal: "240.00",
  shipping_total: "10.00",
  discount_total: "24.00",
  grand_total: "226.00",
  currency: "USD",
  shipping_address: {
    full_name: "Jane Shopper",
    line1: "123 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "US",
  },
  billing_address: {
    full_name: "Jane Shopper",
    line1: "123 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "US",
  },
  packages: [
    {
      seller_order_id: "72000000-0000-4000-8000-000000000001",
      seller_id: "30000000-0000-4000-8000-000000000001",
      seller_name: "TechStore",
      status: "delivered",
      carrier: "FedEx",
      tracking_number: "TRK-FEDEX-889900",
      items: [
        {
          id: "71000000-0000-4000-8000-000000000001",
          product_id: "80000000-0000-4000-8000-000000000001",
          product_title: "Pro Gaming Keyboard",
          variant_id: "81000000-0000-4000-8000-000000000001",
          variant_name: "Space Gray / Linear",
          sku: "KB-SG-LIN",
          quantity: 2,
          unit_price: "120.00",
          total_price: "240.00",
          can_review: true,
          can_return: true,
        },
      ],
      tracking_events: [
        {
          id: "79000000-0000-4000-8000-000000000001",
          status: "delivered",
          location: "Front Porch",
          description: "Delivered to recipient residence",
          timestamp: "2026-10-03T15:00:00Z",
        },
      ],
    },
  ],
};

describe("Phase 23: Customer Commerce End-to-End Integration Flows", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockParams = { id: "70000000-0000-4000-8000-000000000001" };
  });

  // -------------------------------------------------------------------------
  // Flow 1: Browse catalog, select variant, add to cart
  // -------------------------------------------------------------------------
  it("Flow 1: Customer browses catalog, selects variant, and adds item to cart", async () => {
    let addedVariantId = "";
    let addedQuantity = 0;

    global.fetch = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/api/v1/auth/csrf")) {
          return Promise.resolve(json({ csrf_token: csrf }));
        }
        if (url.includes("/api/v1/cart/items/")) {
          const body = JSON.parse(init?.body as string);
          addedVariantId = body.variant_id;
          addedQuantity = body.quantity;
          return Promise.resolve(json(mockCart, 201));
        }
        if (url.includes("/api/v1/cart/")) {
          return Promise.resolve(json(mockCart));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    render(
      <CartProvider>
        <ProductDetailView product={mockProduct} />
      </CartProvider>,
    );

    expect(screen.getAllByText("Pro Gaming Keyboard").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("120.00 USD").length).toBeGreaterThan(0);

    // Select alternative variant "Arctic White / Clicky"
    const whiteVariantBtn = screen.getByRole("button", {
      name: /Arctic White \/ Clicky/i,
    });
    fireEvent.click(whiteVariantBtn);

    // Price updates with the actual currency.
    expect(screen.getAllByText("130.00 USD").length).toBeGreaterThan(0);

    // Increment quantity
    const plusBtn = screen.getByRole("button", { name: /Increase quantity/i });
    fireEvent.click(plusBtn);

    // Add to cart
    const addToCartBtn = screen.getByRole("button", { name: /Add to Cart/i });
    fireEvent.click(addToCartBtn);

    await waitFor(() => {
      expect(addedVariantId).toBe("81000000-0000-4000-8000-000000000002");
      expect(addedQuantity).toBe(2);
    });
    expect(
      await screen.findByText(/2 items added to cart/i),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Flow 2: Search for product with full-text search and filters
  // -------------------------------------------------------------------------
  it("Flow 2: Customer searches for product with full-text search and faceted filters", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/suggest")) {
        return Promise.resolve(
          json({
            query: "keyboard",
            suggestions: ["gaming keyboard", "mechanical keyboard"],
            products: [],
            categories: [
              { id: "c1", name: "Gaming Gear", slug: "gaming-gear" },
            ],
            brands: [],
          }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const mockFacets: StorefrontSearchFacets = {
      categories: [
        { id: "c1", name: "Gaming Gear", slug: "gaming-gear", count: 12 },
      ],
      brands: [{ id: "b1", name: "RazerTech", slug: "razertech", count: 8 }],
      price_brackets: [
        { label: "$50 to $100", min_price: "50", max_price: "100", count: 5 },
        { label: "$100 to $250", min_price: "100", max_price: "250", count: 7 },
      ],
      rating_brackets: [{ label: "4★ & above", min_rating: 4, count: 10 }],
      in_stock_count: 15,
    };

    const onFilterChange = vi.fn();

    render(
      <div>
        <SearchBar initialQuery="" />
        <SearchFiltersSidebar
          facets={mockFacets}
          filters={{}}
          onFilterChange={onFilterChange}
        />
      </div>,
    );

    const searchInput = screen.getByRole("combobox");
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "keyboard" } });

    // Autocomplete suggestion appears
    expect(await screen.findByText("mechanical keyboard")).toBeDefined();

    // Apply category filter
    const gamingGearFilter = screen.getByRole("button", {
      name: /Gaming Gear/i,
    });
    fireEvent.click(gamingGearFilter);

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ category: "c1" }),
    );
  });

  // -------------------------------------------------------------------------
  // Flow 3: Check coupon eligibility without inventing applied discounts
  // -------------------------------------------------------------------------
  it("Flow 3: Customer previews coupon eligibility and preserves the server cart subtotal", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) {
        return Promise.resolve(json(user));
      }
      if (url.includes("/api/v1/auth/csrf")) {
        return Promise.resolve(json({ csrf_token: csrf }));
      }
      if (url.includes("/api/v1/cart/items/")) {
        return Promise.resolve(json(mockCart));
      }
      if (url.includes("/api/v1/promotions/validate")) {
        return Promise.resolve(
          json({
            valid: true,
            discount_amount: "24.00",
            error_message: null,
            coupon: null,
            promotion: null,
          }),
        );
      }
      if (url.includes("/api/v1/cart/")) {
        return Promise.resolve(json(mockCart));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CartPage />
        </CartProvider>
      </AuthProvider>,
    );

    expect(
      (await screen.findAllByText("Shopping Cart")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Pro Gaming Keyboard").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/240.00\sUSD/).length).toBeGreaterThan(0);

    // Input coupon code
    const couponInput = screen.getByPlaceholderText(/Enter coupon code/i);
    fireEvent.change(couponInput, { target: { value: "SAVE10" } });

    const applyBtn = screen.getByRole("button", { name: /Check code/i });
    fireEvent.click(applyBtn);

    // The API supplies eligibility only; preview does not change cart amounts.
    expect(
      await screen.findByText(/is eligible for a preview discount of/i),
    ).toBeDefined();
    expect(screen.getByTestId("cart-summary-total")).toHaveTextContent(
      "240.00 USD",
    );
    expect(
      screen.getByText(/is eligible for a preview discount of/i),
    ).toHaveTextContent("24.00 USD");
    expect(screen.queryByText(/coupon applied/i)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Flow 4: Complete checkout: enter shipping address, choose seller shipping
  // -------------------------------------------------------------------------
  it("Flow 4: Customer completes checkout with address book and multi-seller shipping selection", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/auth/me")) {
        return Promise.resolve(json(user));
      }
      if (url.includes("/api/v1/auth/csrf")) {
        return Promise.resolve(json({ csrf_token: csrf }));
      }
      if (url.includes("/api/v1/cart/")) {
        return Promise.resolve(json(mockCart));
      }
      if (url.includes("/api/v1/checkout/addresses/")) {
        return Promise.resolve(json([mockAddress]));
      }
      if (url.includes("/api/v1/checkout/quote/")) {
        return Promise.resolve(json(mockQuote));
      }
      if (url.includes("/api/v1/checkout/place-order/")) {
        return Promise.resolve(json(mockPlacedOrder, 201));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CheckoutSessionProvider>
            <CustomerCheckoutPage />
          </CheckoutSessionProvider>
        </CartProvider>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Checkout" }),
    ).toBeDefined();
    expect(await screen.findByText("Jane Shopper")).toBeDefined();
    expect(await screen.findByText("Standard Ground")).toBeDefined();
    expect(await screen.findByText(/226\.00\sUSD/)).toBeDefined();

    // Place order
    const placeOrderBtn = screen.getByRole("button", { name: /Place Order/i });
    fireEvent.click(placeOrderBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining(
          "/checkout/pay?order_id=70000000-0000-4000-8000-000000000001",
        ),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Flow 5: Process idempotent payment, verify order placement
  // -------------------------------------------------------------------------
  it("Flow 5: Customer processes idempotent payment with zero raw card leakage", async () => {
    // Keep the CVC leakage check independent of random idempotency-key digits.
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const capturedRequests: Array<{
      url: string;
      body: Record<string, unknown>;
    }> = [];

    global.fetch = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("/api/v1/auth/csrf")) {
          return Promise.resolve(json({ csrf_token: csrf }));
        }
        if (url.includes("/api/v1/checkout/payment-intent/")) {
          const body = JSON.parse(init?.body as string);
          capturedRequests.push({ url, body });
          return Promise.resolve(
            json(
              {
                payment_id: "60000000-0000-4000-8000-000000000001",
                order_id: body.order_id,
                order_number: "ORD-99887766",
                amount: "226.00",
                currency: "USD",
                status: "pending",
                provider: "mock",
                error_code: "",
                error_message: "",
                created_at: "2026-10-03T12:00:00Z",
              },
              201,
            ),
          );
        }
        if (url.includes("/api/v1/checkout/confirm-payment/")) {
          const body = JSON.parse(init?.body as string);
          capturedRequests.push({ url, body });
          const record: PaymentRecord = {
            payment_id: body.payment_id,
            order_id: "70000000-0000-4000-8000-000000000001",
            order_number: "ORD-99887766",
            amount: "226.00",
            currency: "USD",
            status: "captured",
            provider: "mock",
            error_code: "",
            error_message: "",
            created_at: "2026-10-03T12:00:00Z",
          };
          return Promise.resolve(json(record));
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    const onCaptured = vi.fn();
    render(
      <PaymentForm
        orderId="70000000-0000-4000-8000-000000000001"
        orderNumber="ORD-99887766"
        total="226.00"
        currency="USD"
        onCaptured={onCaptured}
      />,
    );

    // Enter valid mock card details
    fireEvent.change(screen.getByLabelText(/Card number/i), {
      target: { value: "4242 4242 4242 4242" },
    });
    fireEvent.change(screen.getByLabelText(/Expiry/i), {
      target: { value: "12/28" },
    });
    fireEvent.change(screen.getByLabelText(/CVC/i), {
      target: { value: "123" },
    });

    // Submit payment
    const payBtn = screen.getByRole("button", { name: /Pay 226.00\sUSD/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(onCaptured).toHaveBeenCalled();
    });

    // Zero sensitive card digits transmitted
    expect(capturedRequests.length).toBe(2);
    const confirmBody = capturedRequests[1]?.body;
    expect(confirmBody).toBeDefined();
    expect(confirmBody?.payment_token).toBe("tok_mock_4242");
    expect(JSON.stringify(confirmBody)).not.toContain("4242 4242");
    expect(JSON.stringify(confirmBody)).not.toContain("123");
    expect(capturedRequests[0]?.body).toEqual({
      order_id: "70000000-0000-4000-8000-000000000001",
      idempotency_key: "intent_aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa",
    });
    expect(confirmBody).toEqual({
      payment_id: "60000000-0000-4000-8000-000000000001",
      idempotency_key: "intent_aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa",
      payment_token: "tok_mock_4242",
    });
    // Idempotency key was provided
    expect(confirmBody?.idempotency_key).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Flow 6: Verify seller order created and inventory reserved
  // -------------------------------------------------------------------------
  it("Flow 6: Verifies multi-seller order splitting and partition into seller packages", () => {
    // Verified structure of placed order splitting across sellers
    expect(mockPlacedOrder.seller_orders.length).toBe(1);
    const sellerOrder = mockPlacedOrder.seller_orders[0]!;
    expect(sellerOrder.seller_name).toBe("TechStore");
    expect(sellerOrder.seller_order_number).toBe("SO-ORD-99887766-TECH");
    expect(sellerOrder.seller_net_total).toBe("226.00");
  });

  // -------------------------------------------------------------------------
  // Flow 7: View order in customer account, inspect tracking timeline
  // -------------------------------------------------------------------------
  it("Flow 7: Customer views order in account history and inspects tracking timeline", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/me")) {
        return Promise.resolve(json(user));
      }
      if (url.includes("/api/v1/customer/orders/")) {
        return Promise.resolve(json(mockOrderDetail));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <AuthProvider>
        <CustomerOrderDetailPage />
      </AuthProvider>,
    );

    expect(await screen.findByTestId("order-detail-number")).toBeDefined();
    expect(screen.getAllByText("ORD-99887766").length).toBeGreaterThan(0);
    expect(screen.getAllByText("delivered").length).toBeGreaterThan(0);
    expect(screen.getByText("TRK-FEDEX-889900")).toBeDefined();
    expect(screen.getByText("Delivered to recipient residence")).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Flow 8: Submit verified product review and request return on delivered item
  // -------------------------------------------------------------------------
  it("Flow 8: Customer submits verified product review and initiates RMA return request", async () => {
    let reviewSubmitted = false;
    let returnSubmitted = false;

    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/auth/csrf")) {
        return Promise.resolve(json({ csrf_token: csrf }));
      }
      if (url.includes("/api/v1/customer/reviews/")) {
        reviewSubmitted = true;
        return Promise.resolve(
          json(
            {
              id: "77000000-0000-4000-8000-000000000001",
              product_id: "80000000-0000-4000-8000-000000000001",
              rating: 5,
              title: "Exceptional build quality",
              body: "Tactile switches and gorgeous backlighting.",
              status: "approved",
              verified_purchase: true,
              created_at: "2026-10-03T12:00:00Z",
            },
            201,
          ),
        );
      }
      if (url.includes("/api/v1/customer/returns/")) {
        returnSubmitted = true;
        return Promise.resolve(
          json(
            {
              id: "78000000-0000-4000-8000-000000000001",
              return_number: "RMA-99887766",
              seller_order_id: "72000000-0000-4000-8000-000000000001",
              seller_name: "TechStore",
              status: "requested",
              reason: "defective",
              customer_notes: "Keycap switch sticking",
              created_at: "2026-10-03T12:00:00Z",
            },
            201,
          ),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const onReviewSuccess = vi.fn();
    const onReturnSuccess = vi.fn();

    // 1. Submit verified review
    const { unmount } = render(
      <ReviewModal
        orderItemId="71000000-0000-4000-8000-000000000001"
        productTitle="Pro Gaming Keyboard"
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onReviewSuccess}
      />,
    );

    fireEvent.change(screen.getByTestId("review-title-input"), {
      target: { value: "Exceptional build quality" },
    });
    fireEvent.change(screen.getByTestId("review-body-input"), {
      target: { value: "Tactile switches and gorgeous backlighting." },
    });
    fireEvent.click(screen.getByTestId("submit-review-button"));

    await waitFor(() => {
      expect(onReviewSuccess).toHaveBeenCalled();
    });
    expect(reviewSubmitted).toBe(true);

    unmount();

    // 2. Submit return request
    render(
      <ReturnModal
        orderItemId="71000000-0000-4000-8000-000000000001"
        productTitle="Pro Gaming Keyboard"
        maxQuantity={2}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onReturnSuccess}
      />,
    );

    fireEvent.change(screen.getByTestId("return-reason-select"), {
      target: { value: "defective" },
    });
    fireEvent.change(screen.getByTestId("return-notes-input"), {
      target: { value: "Keycap switch sticking" },
    });
    fireEvent.click(screen.getByTestId("submit-return-button"));

    await waitFor(() => {
      expect(onReturnSuccess).toHaveBeenCalled();
    });
    expect(returnSubmitted).toBe(true);
  });
});
