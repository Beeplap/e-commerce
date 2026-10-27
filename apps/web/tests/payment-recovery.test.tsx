import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CheckoutSessionProvider } from "@/features/checkout/session";
import { CheckoutPayContent } from "@/features/checkout/pay-page";
import { CheckoutSuccessContent } from "@/features/checkout/success-page";
import { PaymentForm } from "@/features/checkout/payment-form";
import { parseOrderPaymentState } from "@/lib/api/validation";
import type { OrderPaymentState, PaymentRecord } from "@/lib/api/types";
import { csrf, json } from "./fixtures";

const id = "50000000-0000-4000-8000-000000000001";
const key = "intent_original_attempt_1234";
const payment: PaymentRecord = {
  payment_id: "60000000-0000-4000-8000-000000000001",
  order_id: id,
  order_number: "ORD-RECOVERY",
  amount: "55.00",
  currency: "USD",
  status: "pending",
  provider: "mock",
  error_code: "",
  error_message: "",
  created_at: "2026-10-27T00:00:00Z",
};
const pending: OrderPaymentState = {
  order_id: id,
  order_number: payment.order_number,
  grand_total: payment.amount,
  currency: payment.currency,
  payment_status: "pending",
  fulfillment_status: "unfulfilled",
  payment,
  resume_key: key,
};
const paid: OrderPaymentState = {
  ...pending,
  payment_status: "paid",
  payment: { ...payment, status: "captured" },
  resume_key: null,
};
const push = vi.fn();
let query = new URLSearchParams(`order_id=${id}`);
vi.mock("next/navigation", () => ({
  useSearchParams: () => query,
  useRouter: () => ({ push }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  query = new URLSearchParams(`order_id=${id}`);
  push.mockReset();
});
type Override = (
  url: string,
  init?: RequestInit,
) => Response | Promise<Response> | undefined;
function api(
  state: OrderPaymentState = pending,
  override: Override = () => undefined,
) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const result = override(url, init);
    if (result) return result;
    if (url.endsWith("/auth/me"))
      return json({ detail: "Not authenticated" }, 403);
    if (url.endsWith("/auth/csrf")) return json({ csrf_token: csrf });
    if (url.endsWith("/payment-state/")) return json(state);
    if (url.endsWith("/confirm-payment/")) return json(paid.payment);
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
function tree(children: ReactNode) {
  return (
    <AuthProvider>
      <CheckoutSessionProvider>{children}</CheckoutSessionProvider>
    </AuthProvider>
  );
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
function form(onCaptured = vi.fn()) {
  return (
    <PaymentForm
      orderId={id}
      orderNumber={payment.order_number}
      total="55.00"
      currency="USD"
      onCaptured={onCaptured}
    />
  );
}

describe("Payment recovery across reloads", () => {
  it("recovers a created intent whose response was lost, even after remount", async () => {
    let stored: OrderPaymentState = {
      ...pending,
      payment: null,
      resume_key: null,
    };
    const fetch = api(pending, (url, init) => {
      if (url.includes("payment-state")) return json(stored);
      if (url.includes("payment-intent")) {
        stored = {
          ...pending,
          resume_key: JSON.parse(String(init?.body)).idempotency_key,
        };
        return Promise.reject(new TypeError("Connection lost"));
      }
    });
    const first = render(form());
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay 55.00/ }));
    await screen.findByTestId("payment-error");
    expect(screen.getByLabelText("CVC")).toHaveValue("");
    first.unmount();
    const captured = vi.fn();
    render(form(captured));
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay 55.00/ }));
    await waitFor(() => expect(captured).toHaveBeenCalled());
    expect(
      fetch.mock.calls.filter(([url]) =>
        String(url).includes("payment-intent"),
      ),
    ).toHaveLength(1);
    const confirmation = fetch.mock.calls.find(([url]) =>
      String(url).includes("confirm-payment"),
    );
    expect(JSON.parse(String(confirmation?.[1]?.body)).idempotency_key).toBe(
      stored.resume_key,
    );
  });
  it("reads recorded capture after losing its response instead of charging again", async () => {
    let stored = pending;
    const fetch = api(pending, (url) => {
      if (url.includes("payment-state")) return json(stored);
      if (url.includes("confirm-payment")) {
        stored = paid;
        return Promise.reject(new TypeError("Connection lost"));
      }
    });
    const first = render(tree(<CheckoutPayContent />));
    await screen.findByLabelText("Card number");
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay 55.00/ }));
    await screen.findByTestId("payment-error");
    expect(push).not.toHaveBeenCalled();
    first.unmount();
    render(tree(<CheckoutSuccessContent />));
    await screen.findByText("Thank you. Your order is confirmed.");
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });
  it("discards private recovery evidence from a previous order route", async () => {
    let release: ((value: Response) => void) | undefined;
    const otherId = "50000000-0000-4000-8000-000000000002";
    const fetch = api(pending, (url) => {
      if (url.includes(otherId))
        return json({ detail: "This resource is unavailable." }, 404);
      if (url.includes("payment-state"))
        return new Promise((resolve) => {
          release = resolve;
        });
    });
    const view = render(tree(<CheckoutSuccessContent />));
    await waitFor(() => expect(release).toBeDefined());
    query = new URLSearchParams(`order_id=${otherId}`);
    view.rerender(tree(<CheckoutSuccessContent />));
    await screen.findByText("Order status unavailable");
    await act(async () => release!(json(paid)));
    expect(
      screen.queryByTestId("success-order-number"),
    ).not.toBeInTheDocument();
    expect(
      fetch.mock.calls.find(([url]) => String(url).includes(id))?.[1]?.signal
        ?.aborted,
    ).toBe(true);
  });
  it("resumes the original attempt after remount with fresh CSRF and no second intent", async () => {
    const fetch = api();
    const first = render(tree(<CheckoutPayContent />));
    await screen.findByLabelText("Card number");
    first.unmount();
    render(tree(<CheckoutPayContent />));
    await screen.findByLabelText("Card number");
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay 55.00/ }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/checkout/success?order_id=${id}`),
    );
    const commands = fetch.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(commands).toHaveLength(1);
    expect(commands[0]![0]).toContain("/confirm-payment/");
    expect(JSON.parse(String(commands[0]![1]?.body))).toEqual({
      payment_id: payment.payment_id,
      idempotency_key: key,
      payment_token: "tok_mock_4242",
    });
    expect(new Headers(commands[0]![1]?.headers).get("X-CSRFToken")).toBe(csrf);
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes("payment-intent")),
    ).toBe(false);
  });
  it("recovers a lost successful confirmation on a guest success reload using server evidence", async () => {
    const fetch = api(paid);
    render(tree(<CheckoutSuccessContent />));
    expect(
      await screen.findByText("Thank you. Your order is confirmed."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("success-order-number")).toHaveTextContent(
      payment.order_number,
    );
    expect(fetch.mock.calls.every(([, init]) => init?.method === "GET")).toBe(
      true,
    );
  });
  it("does not send another payment command when a fresh read finds capture", async () => {
    const fetch = api(paid),
      captured = vi.fn();
    render(form(captured));
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay 55.00/ }));
    await waitFor(() => expect(captured).toHaveBeenCalledWith(paid.payment));
    expect(fetch.mock.calls).toHaveLength(1);
    expect(fetch.mock.calls[0]![1]?.method).toBe("GET");
  });
  it("denies a forged UUID and query claims when the Django session has no order access", async () => {
    query.set("total", "0.01");
    query.set("paid", "true");
    api(paid, (url) =>
      url.includes("payment-state")
        ? json({ detail: "This resource is unavailable." }, 404)
        : undefined,
    );
    render(tree(<CheckoutSuccessContent />));
    await screen.findByText("Order status unavailable");
    expect(
      screen.queryByText("Thank you. Your order is confirmed."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("success-order-number"),
    ).not.toBeInTheDocument();
  });
  it.each([
    {
      ...pending,
      payment_status: "failed",
      fulfillment_status: "cancelled",
      payment: { ...payment, status: "failed" },
      resume_key: null,
    },
    { ...pending, fulfillment_status: "cancelled", resume_key: null },
    {
      ...pending,
      payment: { ...payment, status: "authorized" },
      resume_key: null,
    },
    paid,
  ])(
    "offers no card form or automatic commands for terminal/processing evidence %#",
    async (state) => {
      const fetch = api(state as OrderPaymentState);
      render(tree(<CheckoutPayContent />));
      await screen.findByText(/No further payment will be requested/);
      expect(screen.queryByLabelText("Card number")).not.toBeInTheDocument();
      expect(fetch.mock.calls.every(([, init]) => init?.method === "GET")).toBe(
        true,
      );
    },
  );
  it("read-only review does not create an intent", async () => {
    const fetch = api();
    render(<PaymentForm orderId={id} onCaptured={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Review payment" }));
    await screen.findByLabelText("Card number");
    expect(fetch.mock.calls).toHaveLength(1);
    expect(fetch.mock.calls[0]![1]?.method).toBe("GET");
  });
  it("does not dispatch an unsafe command after unmount during recovery", async () => {
    let release: ((value: Response) => void) | undefined;
    const fetch = api(pending, (url) =>
      url.includes("payment-state")
        ? new Promise((resolve) => {
            release = resolve;
          })
        : undefined,
    );
    const captured = vi.fn(),
      view = render(form(captured));
    card();
    fireEvent.click(screen.getByRole("button", { name: /Pay 55.00/ }));
    await waitFor(() => expect(release).toBeDefined());
    view.unmount();
    await act(async () => release!(json(pending)));
    expect(fetch.mock.calls).toHaveLength(1);
    expect(captured).not.toHaveBeenCalled();
  });
  it("shows retry after a recovery read failure without revealing or charging an order", async () => {
    let fail = true;
    const fetch = api(paid, (url) =>
      url.includes("payment-state") && fail ? json({}, 503) : undefined,
    );
    render(tree(<CheckoutSuccessContent />));
    await screen.findByText("Order status unavailable");
    expect(
      screen.queryByTestId("success-order-number"),
    ).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Reload order status" }),
    );
    await screen.findByText("Thank you. Your order is confirmed.");
    expect(fetch.mock.calls.every(([, init]) => init?.method === "GET")).toBe(
      true,
    );
  });
});

describe("Recovery response boundary", () => {
  it.each([
    { ...pending, order_id: payment.payment_id },
    { ...pending, resume_key: "short" },
    { ...pending, resume_key: null },
    { ...paid, resume_key: key },
    { ...pending, currency: "usd" },
    { ...pending, grand_total: "0.01" },
    { ...pending, payment: { ...payment, order_id: payment.payment_id } },
    { ...pending, payment: { ...payment, amount: "NaN" } },
    { ...pending, payment: { ...payment, status: "captured" } },
    { ...pending, payment: { ...payment, created_at: "invalid" } },
    { ...pending, payment: undefined },
    { ...pending, fulfillment_status: "unknown" },
    { ...pending, fulfillment_status: ["unfulfilled"] },
    { ...pending, payment_status: ["pending"] },
  ])("rejects mismatched/malformed recovery evidence %#", (value) => {
    expect(() => parseOrderPaymentState(value, id)).toThrow();
  });
  it("retains exact money and strips unconsumed fields", () => {
    const value = parseOrderPaymentState(
      { ...pending, customer_email: "private@example.com" },
      id,
    );
    expect(value).toEqual(pending);
    expect(value).not.toHaveProperty("customer_email");
  });
});
