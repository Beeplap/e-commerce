import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import CheckoutPage from "@/app/checkout/page";
import PayPage from "@/app/checkout/pay/page";
import SuccessPage from "@/app/checkout/success/page";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-context";
import {
  CheckoutSessionProvider,
  useCheckoutSession,
} from "@/features/checkout/session";
import {
  addressesEvidence,
  customerOrderEvidence,
  orderIdFromQuery,
  paymentEvidence,
  placedEvidence,
  quoteEvidence,
} from "@/features/checkout/evidence";
import { PaymentForm } from "@/features/checkout/payment-form";
import type { PaymentRecord, CheckoutQuote } from "@/lib/api/types";
import {
  mockCart,
  mockAddresses,
  mockOrder,
  mockPlacedOrder,
  mockQuote,
} from "./checkout-fixtures";
import { csrf, json, user } from "./fixtures";

const push = vi.fn();
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/checkout",
  useSearchParams: () => query,
}));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  query = new URLSearchParams();
  push.mockReset();
  vi.restoreAllMocks();
});
const payment: PaymentRecord = {
  payment_id: "60000000-0000-4000-8000-000000000001",
  order_id: mockOrder.id,
  order_number: mockOrder.order_number,
  amount: "55.00",
  currency: "USD",
  status: "pending",
  provider: "mock",
  error_code: "",
  error_message: "",
  created_at: "2026-10-01T12:00:00Z",
};
function tree(children: ReactNode) {
  return (
    <AuthProvider>
      <CartProvider>
        <CheckoutSessionProvider>{children}</CheckoutSessionProvider>
      </CartProvider>
    </AuthProvider>
  );
}
type Override = (
  url: string,
  init?: RequestInit,
) => Promise<Response> | Response | undefined;
function api(override: Override = () => undefined, guest = false) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input),
      custom = override(url, init);
    if (custom) return custom;
    if (url.includes("/auth/csrf")) return json({ csrf_token: csrf });
    if (url.includes("/auth/me"))
      return guest ? json({ detail: "Not authenticated" }, 403) : json(user);
    if (url.includes("/cart/")) return json(mockCart);
    if (url.includes("/checkout/addresses/")) return json(mockAddresses);
    if (url.includes("/checkout/quote/")) return json(mockQuote);
    if (url.includes("/checkout/place-order/"))
      return json(mockPlacedOrder, 201);
    if (url.includes("/customer/orders/")) return json(mockOrder);
    if (url.includes("/checkout/payment-intent/")) return json(payment, 201);
    if (url.includes("/checkout/confirm-payment/"))
      return json({ ...payment, status: "captured" });
    return json([]);
  });
  global.fetch = spy;
  return spy;
}
async function ready() {
  await screen.findByText("Acme Standard Ground");
  return screen.getByRole("button", { name: /Confirm & place order/ });
}
function card() {
  fireEvent.change(screen.getByLabelText("Card number"), {
    target: { value: "4242 4242 4242 4242" },
  });
  fireEvent.change(screen.getByLabelText("Expiry (MM/YY)"), {
    target: { value: "12/35" },
  });
  fireEvent.change(screen.getByLabelText("CVC"), { target: { value: "123" } });
}
const form = (onCaptured = vi.fn()) => (
  <PaymentForm
    orderId={mockOrder.id}
    orderNumber={mockOrder.order_number}
    total="55.00"
    currency="USD"
    onCaptured={onCaptured}
  />
);

describe("Checkout presentation evidence", () => {
  it("recognizes Django's authorized order state without calling it paid", () => {
    expect(
      customerOrderEvidence(
        { ...mockOrder, payment_status: "authorized" },
        mockOrder.id,
      ).paymentStatus,
    ).toBe("authorized");
    expect(() =>
      customerOrderEvidence(
        { ...mockOrder, payment_status: "invented" },
        mockOrder.id,
      ),
    ).toThrow();
  });
  it("accepts precise server amounts including repricing without floating point", () => {
    const quote = structuredClone(mockQuote);
    quote.subtotal = "18014398509481986.02";
    quote.grand_total = "18014398509481991.02";
    quote.sellers[0]!.subtotal = quote.subtotal;
    quote.sellers[0]!.total = quote.grand_total;
    quote.sellers[0]!.items[0]!.unit_price = "9007199254740993.01";
    quote.sellers[0]!.items[0]!.line_subtotal = quote.subtotal;
    expect(quoteEvidence(quote, mockCart, {}).grand_total).toBe(
      quote.grand_total,
    );
  });
  it.each([
    [
      "negative amount",
      (q: CheckoutQuote) => {
        q.grand_total = "-1.00";
      },
    ],
    [
      "invalid currency",
      (q: CheckoutQuote) => {
        q.currency = "<USD>";
      },
    ],
    [
      "inconsistent total",
      (q: CheckoutQuote) => {
        q.grand_total = "56.00";
      },
    ],
    [
      "foreign seller",
      (q: CheckoutQuote) => {
        q.sellers[0]!.seller_id = mockOrder.id;
      },
    ],
    [
      "foreign item",
      (q: CheckoutQuote) => {
        q.sellers[0]!.items[0]!.item_id = mockOrder.id;
      },
    ],
    [
      "changed quantity",
      (q: CheckoutQuote) => {
        q.sellers[0]!.items[0]!.quantity = 1;
      },
    ],
    [
      "duplicate method",
      (q: CheckoutQuote) => {
        q.sellers[0]!.available_shipping_methods.push(
          q.sellers[0]!.available_shipping_methods[0]!,
        );
      },
    ],
    [
      "changed selected rate",
      (q: CheckoutQuote) => {
        q.sellers[0]!.selected_shipping_method!.rate = "0.00";
      },
    ],
    [
      "false stock claim",
      (q: CheckoutQuote) => {
        q.sellers[0]!.items[0]!.available_stock = 0;
      },
    ],
  ] as const)("rejects %s without usable totals", (_name, change) => {
    const quote = structuredClone(mockQuote);
    change(quote);
    expect(() => quoteEvidence(quote, mockCart, {})).toThrow(
      /review could not be verified/,
    );
  });
  it("rejects a quote that silently substituted a shipping selection", () => {
    expect(() =>
      quoteEvidence(mockQuote, mockCart, {
        [mockCart.sellers[0]!.seller_id]:
          mockQuote.sellers[0]!.available_shipping_methods[1]!.method_id,
      }),
    ).toThrow();
  });
  it("projects only consumed placement evidence, excluding email and payment secrets", () => {
    const value = placedEvidence({
      ...mockPlacedOrder,
      payment_instructions: { client_secret: "private" },
    });
    expect(Object.keys(value).sort()).toEqual([
      "amount",
      "currency",
      "id",
      "number",
      "paymentStatus",
    ]);
    expect(JSON.stringify(value)).not.toContain("private");
    expect(JSON.stringify(value)).not.toContain("alice");
  });
  it("rejects wrong order or payment identity", () => {
    expect(() => customerOrderEvidence(mockOrder, user.id)).toThrow();
    expect(() => paymentEvidence(payment, user.id)).toThrow();
    expect(() =>
      paymentEvidence({ ...payment, amount: "56.00" }, mockOrder.id, payment),
    ).toThrow();
  });
  it("rejects malformed and duplicate saved address records", () => {
    expect(() =>
      addressesEvidence([{ ...mockAddresses[0], full_name: "" }]),
    ).toThrow();
    expect(() =>
      addressesEvidence([mockAddresses[0], mockAddresses[0]]),
    ).toThrow();
  });
  it.each([
    "",
    "order_id=invalid",
    `order_id=${mockOrder.id}&order_id=${mockOrder.id}`,
  ])("rejects ambiguous query %s", (value) => {
    expect(orderIdFromQuery(new URLSearchParams(value))).toBeNull();
  });
});

describe("Checkout recovery and navigation", () => {
  it("discards a late old-address quote after a newer address has been accepted", async () => {
    let first = true;
    let release: ((value: Response) => void) | undefined;
    api((url) => {
      if (url.includes("/quote/") && first) {
        first = false;
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return undefined;
    });
    render(tree(<CheckoutPage />));
    await waitFor(() => expect(release).toBeDefined());
    fireEvent.click(screen.getByRole("radio", { name: /Alice Work/ }));
    expect(await ready()).toBeEnabled();
    await act(async () =>
      release!(json({ ...mockQuote, grand_total: "0.01" })),
    );
    expect(screen.getByTestId("checkout-summary-total")).toHaveTextContent(
      /55.00\sUSD/,
    );
    expect(
      screen.queryByRole("button", { name: "Refresh quote" }),
    ).not.toBeInTheDocument();
  });
  it("keeps cart read failures distinct from a genuine empty cart and retries", async () => {
    let failed = true;
    api((url) =>
      url.includes("/cart/") && failed ? json({}, 503) : undefined,
    );
    render(tree(<CheckoutPage />));
    expect(
      await screen.findByText("Your cart could not be loaded"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument();
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "Reload cart" }));
    await ready();
  });
  it("renders a validated empty state", async () => {
    api((url) =>
      url.includes("/cart/")
        ? json({
            ...mockCart,
            sellers: [],
            total_items: 0,
            total_unique_items: 0,
            subtotal: "0.00",
          })
        : undefined,
    );
    render(tree(<CheckoutPage />));
    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /place order/ }),
    ).not.toBeInTheDocument();
  });
  it("shows quote failure inline and recovers without pretending shipping is free", async () => {
    let failed = true;
    api((url) =>
      url.includes("/quote/") && failed ? json({}, 503) : undefined,
    );
    render(tree(<CheckoutPage />));
    expect(
      await screen.findByRole("button", { name: "Refresh quote" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("checkout-summary-total")).toHaveTextContent(
      "Not quoted yet",
    );
    expect(screen.getByTestId("checkout-summary-shipping")).toHaveTextContent(
      "Awaiting address",
    );
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "Refresh quote" }));
    expect(await ready()).toBeEnabled();
  });
  it("exposes saved address failures and permits explicit new address entry", async () => {
    api((url) => (url.includes("/addresses/") ? json({}, 503) : undefined));
    render(tree(<CheckoutPage />));
    expect(
      await screen.findByRole("button", { name: "Retry saved addresses" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Use a new address" })[0]!,
    );
    fireEvent.blur(screen.getByLabelText("Full name"));
    expect(
      await screen.findByText("Enter a valid full name."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
  it("invalidates the previous quote immediately when the address changes", async () => {
    let delay = false;
    let release: ((value: Response) => void) | undefined;
    api((url) =>
      url.includes("/quote/") && delay
        ? new Promise((resolve) => {
            release = resolve;
          })
        : undefined,
    );
    render(tree(<CheckoutPage />));
    await ready();
    delay = true;
    fireEvent.click(screen.getByRole("radio", { name: /Alice Work/ }));
    expect(screen.getByTestId("checkout-summary-total")).toHaveTextContent(
      "Not quoted yet",
    );
    expect(screen.getByRole("button", { name: /place order/ })).toBeDisabled();
    await waitFor(() => expect(release).toBeDefined());
    await act(async () => release!(json(mockQuote)));
    expect(await ready()).toBeEnabled();
  });
  it("blocks insufficient stock using the current server quote", async () => {
    const quote = structuredClone(mockQuote);
    quote.sellers[0]!.items[0]!.available_stock = 1;
    quote.sellers[0]!.items[0]!.is_in_stock = false;
    api((url) => (url.includes("/quote/") ? json(quote) : undefined));
    render(tree(<CheckoutPage />));
    expect(await ready()).toBeDisabled();
    expect(
      screen.getByText(/Some items do not have enough stock/),
    ).toBeInTheDocument();
  });
  it("does not turn a failed session lookup into guest checkout", async () => {
    api((url) => (url.includes("/auth/me") ? json({}, 503) : undefined));
    render(tree(<CheckoutPage />));
    expect(
      await screen.findByText("Your session could not be checked"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  });
  it("uses UUID-only navigation and freezes accepted placement despite cart refresh failure", async () => {
    let placed = false;
    const spy = api((url) => {
      if (url.includes("/place-order/")) {
        placed = true;
        return json(mockPlacedOrder, 201);
      }
      if (url.includes("/cart/") && placed) return json({}, 503);
    });
    render(tree(<CheckoutPage />));
    const button = await ready();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/checkout/pay?order_id=${mockOrder.id}`,
      ),
    );
    expect(
      spy.mock.calls.filter(([url]) => String(url).includes("/place-order/"))
        .length,
    ).toBe(1);
    expect(push.mock.calls[0]![0]).not.toMatch(/email|total|currency|number/);
    await waitFor(() =>
      expect(
        screen.getByText("Your cart could not be loaded"),
      ).toBeInTheDocument(),
    );
  });
  it("blocks blind order resubmission after an ambiguous server failure", async () => {
    const spy = api((url) =>
      url.includes("/place-order/") ? json({}, 503) : undefined,
    );
    render(tree(<CheckoutPage />));
    fireEvent.click(await ready());
    expect(
      await screen.findByText(/could not verify whether the order was placed/),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /place order/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(
      spy.mock.calls.filter(([url]) => String(url).includes("/place-order/"))
        .length,
    ).toBe(1);
    expect(push).not.toHaveBeenCalled();
  });
  it("never confirms a forged guest success URL", async () => {
    query = new URLSearchParams(
      `order_id=${mockOrder.id}&total=0.01&currency=USD&order_number=FAKE&email=leak@example.com`,
    );
    api(undefined, true);
    render(tree(<SuccessPage />));
    expect(
      await screen.findByText("Payment confirmation unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("success-order-number"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/FAKE|leak@example.com/)).not.toBeInTheDocument();
  });
  it("uses server order evidence and displays pending status honestly", async () => {
    query = new URLSearchParams(`order_id=${mockOrder.id}&total=0.01`);
    api((url) =>
      url.includes("/customer/orders/")
        ? json({ ...mockOrder, payment_status: "pending" })
        : undefined,
    );
    render(tree(<SuccessPage />));
    expect(
      await screen.findByText("Your payment is not confirmed."),
    ).toBeInTheDocument();
    expect(screen.getByText(/^55\.00\sUSD$/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue to payment" }),
    ).toHaveAttribute("href", `/checkout/pay?order_id=${mockOrder.id}`);
  });
  it("requires explicit server review for a guest payment reload, ignoring query amounts", async () => {
    query = new URLSearchParams(
      `order_id=${mockOrder.id}&total=0.01&currency=ABC&order_number=FAKE`,
    );
    const spy = api(undefined, true);
    render(tree(<PayPage />));
    const review = await screen.findByRole("button", {
      name: "Review payment",
    });
    expect(screen.queryByLabelText("Card number")).not.toBeInTheDocument();
    expect(
      spy.mock.calls.some(([url]) => String(url).includes("payment-intent")),
    ).toBe(false);
    fireEvent.click(review);
    expect(
      await screen.findByRole("button", { name: /Pay 55.00\sUSD/ }),
    ).toBeInTheDocument();
    expect(
      spy.mock.calls.some(([url]) => String(url).includes("confirm-payment")),
    ).toBe(false);
  });
  it("shows no payment form or command for duplicate order IDs", async () => {
    query = new URLSearchParams(
      `order_id=${mockOrder.id}&order_id=${mockOrder.id}`,
    );
    const spy = api();
    render(tree(<PayPage />));
    expect(screen.getByText("No pending order found")).toBeInTheDocument();
    await act(async () => {});
    expect(
      spy.mock.calls.some(
        ([url]) =>
          String(url).includes("/customer/orders/") ||
          String(url).includes("payment-intent"),
      ),
    ).toBe(false);
  });
  it("clears checkout presentation snapshots on session refresh", async () => {
    api();
    function Harness() {
      const { refresh } = useAuth();
      const session = useCheckoutSession();
      return (
        <>
          <button
            onClick={() =>
              session.rememberCapture({
                ...placedEvidence(mockPlacedOrder),
                paymentStatus: "paid",
              })
            }
          >
            Remember
          </button>
          <button onClick={() => void refresh()}>Refresh session</button>
          <output>{session.captured?.number ?? "No snapshot"}</output>
        </>
      );
    }
    render(tree(<Harness />));
    await screen.findByText("No snapshot");
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText("Remember"));
    expect(screen.getByText(mockOrder.order_number)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Refresh session"));
    expect(await screen.findByText("No snapshot")).toBeInTheDocument();
  });
});

describe("Payment response boundaries", () => {
  it("excludes raw card inputs from native form serialization", () => {
    render(form());
    card();
    expect(
      Array.from(
        new FormData(
          screen.getByRole("form", { name: "Card payment" }) as HTMLFormElement,
        ).entries(),
      ),
    ).toEqual([]);
  });
  it("clears number, expiry and CVC immediately after local tokenization", async () => {
    let release: ((value: Response) => void) | undefined;
    api((url) =>
      url.includes("payment-intent")
        ? new Promise((resolve) => {
            release = resolve;
          })
        : undefined,
    );
    const view = render(form());
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay/ }));
    expect(screen.getByLabelText("Card number")).toHaveValue("");
    expect(screen.getByLabelText("Expiry (MM/YY)")).toHaveValue("");
    expect(screen.getByLabelText("CVC")).toHaveValue("");
    await waitFor(() => expect(release).toBeDefined());
    view.unmount();
    await act(async () => release!(json(payment, 201)));
  });
  it("does not confirm or navigate after unmount while an intent is pending", async () => {
    let release: ((value: Response) => void) | undefined;
    const spy = api((url) =>
      url.includes("payment-intent")
        ? new Promise((resolve) => {
            release = resolve;
          })
        : undefined,
    );
    const captured = vi.fn(),
      view = render(form(captured));
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay/ }));
    await waitFor(() => expect(release).toBeDefined());
    view.unmount();
    await act(async () => release!(json(payment, 201)));
    expect(
      spy.mock.calls.some(([url]) => String(url).includes("confirm-payment")),
    ).toBe(false);
    expect(captured).not.toHaveBeenCalled();
  });
  it("requires a second review when the intent amount changes, then reuses the same intent", async () => {
    const spy = api((url) =>
      url.includes("payment-intent")
        ? json({ ...payment, amount: "65.00" }, 201)
        : url.includes("confirm-payment")
          ? json({ ...payment, amount: "65.00", status: "captured" })
          : undefined,
    );
    const captured = vi.fn();
    render(form(captured));
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay/ }));
    expect(
      await screen.findByText(/updated payment amount/),
    ).toBeInTheDocument();
    expect(
      spy.mock.calls.some(([url]) => String(url).includes("confirm-payment")),
    ).toBe(false);
    expect(captured).not.toHaveBeenCalled();
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay 65.00\sUSD/ }));
    await waitFor(() => expect(captured).toHaveBeenCalled());
    expect(
      spy.mock.calls.filter(([url]) => String(url).includes("payment-intent"))
        .length,
    ).toBe(1);
  });
  it("rejects a cross-order intent without confirming", async () => {
    const spy = api((url) =>
      url.includes("payment-intent")
        ? json({ ...payment, order_id: user.id }, 201)
        : undefined,
    );
    const captured = vi.fn();
    render(form(captured));
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay/ }));
    expect(
      await screen.findByText(/Payment details could not be verified/),
    ).toBeInTheDocument();
    expect(
      spy.mock.calls.some(([url]) => String(url).includes("confirm-payment")),
    ).toBe(false);
    expect(captured).not.toHaveBeenCalled();
  });
  it("rejects a mismatched captured amount without declaring success", async () => {
    api((url) =>
      url.includes("confirm-payment")
        ? json({ ...payment, amount: "0.01", status: "captured" })
        : undefined,
    );
    const captured = vi.fn();
    render(form(captured));
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay/ }));
    expect(
      await screen.findByText(/Payment details could not be verified/),
    ).toBeInTheDocument();
    expect(captured).not.toHaveBeenCalled();
  });
  it("does not display arbitrary exception details", async () => {
    api((url) =>
      url.includes("payment-intent")
        ? Promise.reject(new Error("private gateway exception"))
        : undefined,
    );
    render(form());
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay/ }));
    expect(await screen.findByTestId("payment-error")).toBeInTheDocument();
    expect(screen.queryByText(/private gateway/)).not.toBeInTheDocument();
  });
});
