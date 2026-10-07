import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "@/features/cart/cart-context";
import { CheckoutSessionProvider } from "@/features/checkout/session";
import { mockOrder } from "./checkout-fixtures";
import { AuthProvider } from "@/features/auth/auth-provider";
import { PaymentForm } from "@/features/checkout/payment-form";
import CheckoutPayPage from "@/app/checkout/pay/page";
import type { PaymentRecord } from "@/lib/api/types";
import { csrf, json, user } from "./fixtures";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams(
  "order_id=50000000-0000-4000-8000-000000000001&order_number=ORD-98765432&total=50.00&currency=USD&email=shopper%40example.com",
);

vi.mock("next/navigation", () => ({
  usePathname: () => "/checkout/pay",
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const mockCapturedPayment: PaymentRecord = {
  payment_id: "60000000-0000-4000-8000-000000000001",
  order_id: "50000000-0000-4000-8000-000000000001",
  order_number: "ORD-98765432",
  amount: "50.00",
  currency: "USD",
  status: "captured",
  provider: "mock",
  error_code: "",
  error_message: "",
  created_at: "2026-10-03T12:00:00Z",
};

describe("Customer Payment & Idempotency", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    mockPush.mockReset();
    mockSearchParams = new URLSearchParams(
      "order_id=50000000-0000-4000-8000-000000000001&order_number=ORD-98765432&total=50.00&currency=USD&email=shopper%40example.com",
    );
  });

  it("validates card number, expiry, and CVC locally before submitting", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    const onCaptured = vi.fn();

    render(
      <PaymentForm
        orderId="50000000-0000-4000-8000-000000000001"
        orderNumber="ORD-98765432"
        total="50.00"
        currency="USD"
        onCaptured={onCaptured}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Pay 50.00\sUSD/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Enter a valid card number.")).toBeDefined();
    expect(
      screen.getByText("Enter a valid, unexpired date (MM/YY)."),
    ).toBeDefined();
    expect(
      screen.getByText("Enter the 3 or 4 digit security code."),
    ).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("completes payment, tokenizes card locally, and never sends card number or CVC", async () => {
    const capturedRequests: Array<{
      url: string;
      body: Record<string, unknown>;
    }> = [];

    global.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/v1/auth/csrf")) {
          return json({ csrf_token: csrf });
        }
        if (url.includes("/api/v1/checkout/payment-intent/")) {
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          capturedRequests.push({ url, body });
          return json(
            {
              ...mockCapturedPayment,
              status: "pending",
            },
            201,
          );
        }
        if (url.includes("/api/v1/checkout/confirm-payment/")) {
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          capturedRequests.push({ url, body });
          return json(mockCapturedPayment, 200);
        }
        return json({});
      },
    );

    const onCaptured = vi.fn();

    render(
      <PaymentForm
        orderId="50000000-0000-4000-8000-000000000001"
        orderNumber="ORD-98765432"
        total="50.00"
        currency="USD"
        onCaptured={onCaptured}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Card number/i), {
      target: { value: "4242 4242 4242 4242" },
    });
    fireEvent.change(screen.getByLabelText(/Expiry/i), {
      target: { value: "12/35" },
    });
    fireEvent.change(screen.getByLabelText(/CVC/i), {
      target: { value: "123" },
    });

    const submitBtn = screen.getByRole("button", { name: /Pay 50.00\sUSD/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCaptured).toHaveBeenCalledWith(mockCapturedPayment);
    });

    expect(capturedRequests).toHaveLength(2);
    const intentReq = capturedRequests[0]!;
    const confirmReq = capturedRequests[1]!;

    // Intent request validation
    expect(intentReq.body.order_id).toBe(
      "50000000-0000-4000-8000-000000000001",
    );
    expect(String(intentReq.body.idempotency_key)).toMatch(
      /^intent_[A-Za-z0-9_-]+/,
    );

    // Confirm request validation
    expect(confirmReq.body.payment_id).toBe(mockCapturedPayment.payment_id);
    expect(confirmReq.body.idempotency_key).toBe(
      intentReq.body.idempotency_key,
    );
    expect(confirmReq.body.payment_token).toBe("tok_mock_4242");

    // Strictly ensure no raw sensitive card data was dispatched
    const allBodyStrings = JSON.stringify(capturedRequests);
    expect(allBodyStrings).not.toContain("4242424242424242");
    expect(allBodyStrings).not.toContain('"cvc"');
    expect(allBodyStrings).not.toContain('"123"');
  });

  it("handles 402 decline by displaying clear cancellation and released stock guidance", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/csrf")) {
        return json({ csrf_token: csrf });
      }
      if (url.includes("/api/v1/checkout/payment-intent/")) {
        return json(
          {
            ...mockCapturedPayment,
            status: "pending",
          },
          201,
        );
      }
      if (url.includes("/api/v1/checkout/confirm-payment/")) {
        return json(
          {
            detail: "The card was declined by the issuer.",
            status: "failed",
            error_code: "card_declined",
          },
          402,
        );
      }
      return json({});
    });

    const onCaptured = vi.fn();

    render(
      <PaymentForm
        orderId="50000000-0000-4000-8000-000000000001"
        orderNumber="ORD-98765432"
        total="50.00"
        currency="USD"
        onCaptured={onCaptured}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Card number/i), {
      target: { value: "4242 4242 4242 4242" },
    });
    fireEvent.change(screen.getByLabelText(/Expiry/i), {
      target: { value: "12/35" },
    });
    fireEvent.change(screen.getByLabelText(/CVC/i), {
      target: { value: "123" },
    });

    const submitBtn = screen.getByRole("button", { name: /Pay 50.00\sUSD/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText("The card was declined by the issuer."),
    ).toBeDefined();
    expect(screen.getByTestId("payment-declined-help")).toBeDefined();
    expect(
      screen.getByText(
        /This order has been cancelled and its reserved items were released/i,
      ),
    ).toBeDefined();

    // After decline, button should be disabled to prevent re-submitting on cancelled order
    expect(submitBtn).toBeDisabled();
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission via double-click guard", async () => {
    let intentCalls = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/auth/csrf")) {
        return json({ csrf_token: csrf });
      }
      if (url.includes("/api/v1/checkout/payment-intent/")) {
        intentCalls += 1;
        // Introduce small artificial latency
        await new Promise((resolve) => setTimeout(resolve, 50));
        return json(
          {
            ...mockCapturedPayment,
            status: "pending",
          },
          201,
        );
      }
      if (url.includes("/api/v1/checkout/confirm-payment/")) {
        return json(mockCapturedPayment, 200);
      }
      return json({});
    });

    render(
      <PaymentForm
        orderId="50000000-0000-4000-8000-000000000001"
        orderNumber="ORD-98765432"
        total="50.00"
        currency="USD"
        onCaptured={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Card number/i), {
      target: { value: "4242 4242 4242 4242" },
    });
    fireEvent.change(screen.getByLabelText(/Expiry/i), {
      target: { value: "12/35" },
    });
    fireEvent.change(screen.getByLabelText(/CVC/i), {
      target: { value: "123" },
    });

    const submitBtn = screen.getByRole("button", { name: /Pay 50.00\sUSD/i });
    // Double click rapidly
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(intentCalls).toBe(1);
    });
  });

  it("renders pay page and navigates to order confirmation upon capture", async () => {
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
      if (url.includes("/api/v1/customer/orders/"))
        return json({
          ...mockOrder,
          grand_total: "50.00",
          payment_status: "pending",
        });
      if (url.includes("/api/v1/cart/")) {
        return json({
          id: "90000000-0000-4000-8000-000000000001",
          total_items: 0,
          total_unique_items: 0,
          subtotal: "0.00",
          currency: "USD",
          has_out_of_stock_items: false,
          sellers: [],
        });
      }
      if (url.includes("/api/v1/checkout/payment-intent/")) {
        return json(
          {
            ...mockCapturedPayment,
            status: "pending",
          },
          201,
        );
      }
      if (url.includes("/api/v1/checkout/confirm-payment/")) {
        return json(mockCapturedPayment, 200);
      }
      return json({});
    });

    render(
      <AuthProvider>
        <CartProvider>
          <CheckoutSessionProvider>
            <CheckoutPayPage />
          </CheckoutSessionProvider>
        </CartProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText("Payment details")).toBeDefined();
    expect(screen.getByTestId("payment-amount").textContent).toBe(
      "50.00\u00a0USD",
    );

    fireEvent.change(screen.getByLabelText(/Card number/i), {
      target: { value: "4242 4242 4242 4242" },
    });
    fireEvent.change(screen.getByLabelText(/Expiry/i), {
      target: { value: "12/35" },
    });
    fireEvent.change(screen.getByLabelText(/CVC/i), {
      target: { value: "123" },
    });

    const submitBtn = screen.getByRole("button", { name: /Pay 50.00\sUSD/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/checkout/success?order_id="),
      );
      expect(mockPush).toHaveBeenCalledWith(
        "/checkout/success?order_id=50000000-0000-4000-8000-000000000001",
      );
    });
  });
});
