import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlacementRecoveryGate,
  placementReference,
  retainPlacementReference,
} from "@/features/checkout/placement-recovery";
import { parsePlacementRecovery } from "@/lib/api/validation";
import { csrf, json } from "./fixtures";

const cart = "90000000-0000-4000-8000-000000000001";
const order = "50000000-0000-4000-8000-000000000001";
const key = "checkout-original-attempt-1234";
const refreshCart = vi.fn(async () => undefined);
vi.mock("@/features/cart/cart-context", () => ({
  useCart: () => ({ refreshCart }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  refreshCart.mockClear();
});

function gate() {
  return (
    <PlacementRecoveryGate>
      <p data-testid="new-checkout">Fresh checkout</p>
    </PlacementRecoveryGate>
  );
}
function api(result: unknown = { status: "placed", order_id: order }) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/auth/csrf")) return json({ csrf_token: csrf });
    if (String(input).endsWith("/recover-placement/")) return json(result);
    throw new Error("Unexpected request");
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("Reload recovery gate", () => {
  it("renders a fresh checkout without issuing a recovery command when there is no reference", async () => {
    const fetch = api();
    render(gate());
    await screen.findByTestId("new-checkout");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retains only cart/attempt identifiers in the fragment and recovers after remount", async () => {
    window.history.replaceState(null, "", "/checkout");
    retainPlacementReference(cart, key);
    const fetch = api();
    const first = render(gate());
    await screen.findByText("Check your previous checkout");
    first.unmount();
    render(gate());
    expect(
      await screen.findByRole("button", { name: "Check original order" }),
    ).toBeEnabled();
    expect(screen.queryByTestId("new-checkout")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe(`#checkout_attempt=${cart}.${key}`);
    fireEvent.click(
      screen.getByRole("button", { name: "Check original order" }),
    );
    await screen.findByText("Your order was found");
    const link = screen.getByRole("link", { name: "Continue to order" });
    expect(link).toHaveAttribute("href", `/checkout/pay?order_id=${order}`);
    const command = fetch.mock.calls.find(([url]) =>
      String(url).endsWith("/recover-placement/"),
    );
    const init = (command as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toEqual({
      cart_id: cart,
      idempotency_key: key,
    });
    expect(new Headers(init.headers).get("X-CSRFToken")).toBe(csrf);
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
    expect(screen.queryByTestId("new-checkout")).not.toBeInTheDocument();
    expect(refreshCart).not.toHaveBeenCalled();
  });
  it("requires durable closure and explicit restart before exposing a new checkout", async () => {
    retainPlacementReference(cart, key);
    api({ status: "cancelled", order_id: null });
    render(gate());
    fireEvent.click(
      await screen.findByRole("button", { name: "Check original order" }),
    );
    await screen.findByText("Your previous attempt is closed");
    expect(screen.queryByTestId("new-checkout")).not.toBeInTheDocument();
    expect(window.location.hash).toContain(key);
    fireEvent.click(
      screen.getByRole("button", { name: "Start checkout again" }),
    );
    await screen.findByTestId("new-checkout");
    expect(refreshCart).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe("");
  });
  it("keeps the new form blocked after foreign-session denial and retries the same reference", async () => {
    retainPlacementReference(cart, key);
    let rejected = true;
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/auth/csrf")
        ? json({ csrf_token: csrf })
        : rejected
          ? json({ detail: "This resource is unavailable." }, 404)
          : json({ status: "placed", order_id: order }),
    );
    vi.stubGlobal("fetch", fetch);
    render(gate());
    fireEvent.click(
      await screen.findByRole("button", { name: "Check original order" }),
    );
    const error = await screen.findByRole("alert");
    await waitFor(() => expect(error).toHaveFocus());
    expect(window.location.hash).toContain(key);
    expect(screen.queryByTestId("new-checkout")).not.toBeInTheDocument();
    rejected = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Check original order" }),
    );
    await screen.findByText("Your order was found");
    expect(
      fetch.mock.calls.filter(([url]) =>
        String(url).includes("recover-placement"),
      ),
    ).toHaveLength(2);
  });
  it("does not declare closure for a rate-limited or failed recovery command", async () => {
    retainPlacementReference(cart, key);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("csrf")
          ? json({ csrf_token: csrf })
          : json({ detail: "Recovery unavailable" }, 429),
      ),
    );
    render(gate());
    fireEvent.click(
      await screen.findByRole("button", { name: "Check original order" }),
    );
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Start checkout again" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("new-checkout")).not.toBeInTheDocument();
  });
  it("blocks duplicate clicks and discards recovery responses after unmount", async () => {
    retainPlacementReference(cart, key);
    let release: ((value: Response) => void) | undefined;
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("csrf")
        ? json({ csrf_token: csrf })
        : new Promise<Response>((resolve) => {
            release = resolve;
          }),
    );
    vi.stubGlobal("fetch", fetch);
    const view = render(gate());
    const button = await screen.findByRole("button", {
      name: "Check original order",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(release).toBeDefined());
    view.unmount();
    await act(async () =>
      release!(json({ status: "cancelled", order_id: null })),
    );
    expect(
      fetch.mock.calls.filter(([url]) =>
        String(url).includes("recover-placement"),
      ),
    ).toHaveLength(1);
    expect(window.location.hash).toContain(key);
    expect(refreshCart).not.toHaveBeenCalled();
  });
  it("responds to a back/fragment navigation without exposing a second checkout", async () => {
    api();
    render(gate());
    await screen.findByTestId("new-checkout");
    act(() => {
      retainPlacementReference(cart, key);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await screen.findByRole("button", { name: "Check original order" });
    expect(screen.queryByTestId("new-checkout")).not.toBeInTheDocument();
  });
  it("blocks malformed recovery references without sending a request", async () => {
    window.history.replaceState(
      null,
      "",
      `/checkout#checkout_attempt=${cart}.${key}&checkout_attempt=other`,
    );
    const fetch = api();
    render(gate());
    await screen.findByRole("alert");
    expect(screen.queryByTestId("new-checkout")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Recovery reference and response boundaries", () => {
  it.each([
    "#checkout_attempt=bad",
    `#checkout_attempt=${cart}.short`,
    `#checkout_attempt=${cart}.${key}.extra`,
    `#checkout_attempt=bad.${key}`,
  ])("rejects malformed identifier %s", (hash) =>
    expect(placementReference(hash)).toBe("invalid"),
  );
  it.each([
    {},
    null,
    { status: "cancelled", order_id: order },
    { status: "placed", order_id: null },
    { status: "placed", order_id: "bad" },
    { status: "unknown", order_id: null },
  ])("rejects unverified recovery responses %#", (value) =>
    expect(() => parsePlacementRecovery(value)).toThrow(),
  );
  it("projects only the recovery outcome and validates order UUID", () => {
    expect(
      parsePlacementRecovery({
        status: "placed",
        order_id: order,
        customer_email: "private@example.com",
      }),
    ).toEqual({ status: "placed", order_id: order });
  });
});
