import { StrictMode, useEffect } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import {
  CartProvider,
  SessionCartProvider,
  useCart,
} from "@/features/cart/cart-context";
import CartPage from "@/app/cart/page";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { cartEvidence, couponEvidence } from "@/features/cart/evidence";
import type { CartResponse } from "@/lib/api/types";
import { csrf, json, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/cart",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});
const item = {
  id: "91000000-0000-4000-8000-000000000001",
  variant_id: "81000000-0000-4000-8000-000000000001",
  product_id: "80000000-0000-4000-8000-000000000001",
  product_title: "Studio headphones",
  product_slug: "studio-headphones",
  variant_name: "Ivory / Standard",
  sku: "STUDIO-IVORY",
  thumbnail_url: null,
  unit_price: "12.50",
  compare_at_price: "15.00",
  quantity: 2,
  line_subtotal: "25.00",
  available_stock: 5,
  is_available: true,
  stock_warning: null,
};
const cart: CartResponse = {
  id: "90000000-0000-4000-8000-000000000001",
  total_items: 2,
  total_unique_items: 1,
  subtotal: "25.00",
  currency: "NPR",
  has_out_of_stock_items: false,
  sellers: [
    {
      seller_id: "30000000-0000-4000-8000-000000000001",
      seller_name: "North studio",
      seller_slug: "north-studio",
      subtotal: "25.00",
      item_count: 2,
      items: [item],
    },
  ],
};
const empty: CartResponse = {
  ...cart,
  total_items: 0,
  total_unique_items: 0,
  subtotal: "0.00",
  sellers: [],
};
const more: CartResponse = {
  ...cart,
  total_items: 3,
  subtotal: "37.50",
  sellers: [
    {
      ...cart.sellers[0]!,
      item_count: 3,
      subtotal: "37.50",
      items: [{ ...item, quantity: 3, line_subtotal: "37.50" }],
    },
  ],
};
const out: CartResponse = {
  ...cart,
  has_out_of_stock_items: true,
  sellers: [
    {
      ...cart.sellers[0]!,
      items: [
        {
          ...item,
          available_stock: 0,
          is_available: false,
          stock_warning: "Out of stock",
        },
      ],
    },
  ],
};
function setup(
  handler?: (
    url: string,
    init?: RequestInit,
  ) => Response | Promise<Response> | undefined,
) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const result = handler?.(url, init);
    if (result) return result;
    if (url.includes("/auth/me"))
      return json({ detail: "Not authenticated" }, 403);
    if (url.includes("/auth/csrf")) return json({ csrf_token: csrf });
    if (url.includes("/storefront/categories")) return json([]);
    if (url.includes("/cart/")) return json(cart);
    throw new Error(`Unexpected request ${url}`);
  });
}
function view(identity = "browser") {
  return (
    <AuthProvider>
      <CartProvider identity={identity}>
        <CartPage />
        <CartDrawer />
      </CartProvider>
    </AuthProvider>
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function Probe() {
  const context = useCart();
  return (
    <>
      <p data-testid="cart-read">
        {context.status}:{context.cart?.subtotal}:
        {context.isLoading ? "busy" : "idle"}
      </p>
      <button
        onClick={() => {
          void context.addItem(item.variant_id).catch(() => {});
        }}
      >
        Add
      </button>
      <button
        onClick={() => {
          void context.refreshCart();
        }}
      >
        Reload
      </button>
    </>
  );
}

describe("Cart evidence", () => {
  it("accepts exact cart and empty evidence without making up totals", () => {
    expect(cartEvidence(cart)).toBe(cart);
    expect(cartEvidence(empty)).toBe(empty);
  });
  it.each([
    [
      "identity",
      (v: CartResponse) => {
        v.id = "cart";
      },
    ],
    [
      "currency",
      (v: CartResponse) => {
        v.currency = "USD<script>";
      },
    ],
    [
      "decimal",
      (v: CartResponse) => {
        v.subtotal = "NaN";
      },
    ],
    [
      "amount bound",
      (v: CartResponse) => {
        v.subtotal = "1".repeat(129);
      },
    ],
    [
      "fraction quantity",
      (v: CartResponse) => {
        v.sellers[0]!.items[0]!.quantity = 1.5;
      },
    ],
    [
      "zero quantity",
      (v: CartResponse) => {
        v.sellers[0]!.items[0]!.quantity = 0;
      },
    ],
    [
      "stock flag",
      (v: CartResponse) => {
        v.sellers[0]!.items[0]!.is_available = false;
      },
    ],
    [
      "line total",
      (v: CartResponse) => {
        v.sellers[0]!.items[0]!.line_subtotal = "25.01";
      },
    ],
    [
      "seller total",
      (v: CartResponse) => {
        v.sellers[0]!.subtotal = "25.01";
      },
    ],
    [
      "cart total",
      (v: CartResponse) => {
        v.subtotal = "25.01";
      },
    ],
    [
      "seller count",
      (v: CartResponse) => {
        v.sellers[0]!.item_count = 1;
      },
    ],
    [
      "cart count",
      (v: CartResponse) => {
        v.total_items = 1;
      },
    ],
    [
      "unique count",
      (v: CartResponse) => {
        v.total_unique_items = 2;
      },
    ],
    [
      "duplicate seller",
      (v: CartResponse) => {
        v.sellers.push(v.sellers[0]!);
      },
    ],
    [
      "duplicate line",
      (v: CartResponse) => {
        v.sellers[0]!.items.push(v.sellers[0]!.items[0]!);
      },
    ],
    [
      "stock summary",
      (v: CartResponse) => {
        v.has_out_of_stock_items = true;
      },
    ],
    [
      "foreign image",
      (v: CartResponse) => {
        v.sellers[0]!.items[0]!.thumbnail_url = "https://example.com/a.png";
      },
    ],
    [
      "foreign product image",
      (v: CartResponse) => {
        v.sellers[0]!.items[0]!.thumbnail_url =
          "/api/v1/storefront/products/80000000-0000-4000-8000-000000000002/images/82000000-0000-4000-8000-000000000001";
      },
    ],
  ])("rejects malformed %s", (_, mutate) => {
    const value = structuredClone(cart);
    mutate(value);
    expect(() => cartEvidence(value)).toThrow();
  });
  it("accepts both real public-stream spellings and exact large amounts", () => {
    const value = structuredClone(cart);
    value.total_items = 1;
    value.sellers[0]!.item_count = 1;
    value.sellers[0]!.items[0]!.quantity = 1;
    value.subtotal =
      value.sellers[0]!.subtotal =
      value.sellers[0]!.items[0]!.unit_price =
      value.sellers[0]!.items[0]!.line_subtotal =
        "9007199254740993.01";
    value.sellers[0]!.items[0]!.thumbnail_url = `/api/v1/storefront/products/${item.product_id}/images/82000000-0000-4000-8000-000000000001`;
    expect(cartEvidence(value)).toBe(value);
    value.sellers[0]!.items[0]!.thumbnail_url += "/";
    expect(cartEvidence(value)).toBe(value);
  });
  it("rejects unbounded groups and rows rather than dropping cart items", () => {
    expect(() =>
      cartEvidence({ ...cart, sellers: Array(1001).fill(cart.sellers[0]!) }),
    ).toThrow();
    expect(() =>
      cartEvidence({
        ...cart,
        sellers: [{ ...cart.sellers[0]!, items: Array(1001).fill(item) }],
      }),
    ).toThrow();
  });
  it.each([
    { valid: "true", discount_amount: "1.00", error_message: null },
    { valid: true, discount_amount: "26.00", error_message: null },
    { valid: true, discount_amount: "-1.00", error_message: null },
    { valid: false, discount_amount: "1.00", error_message: null },
  ])("rejects malformed coupon evidence %j", (value) => {
    expect(() => couponEvidence(value, "25.00")).toThrow();
  });
});

describe("Cart page and provider", () => {
  it("replaces broken public images with a stable accessible fallback", async () => {
    const value = structuredClone(cart);
    value.sellers[0]!.items[0]!.thumbnail_url = `/api/v1/storefront/products/${item.product_id}/images/82000000-0000-4000-8000-000000000001`;
    setup((url) => (url === "/api/v1/cart/" ? json(value) : undefined));
    render(view());
    const image = await screen.findByRole("img", { name: item.product_title });
    expect((image as HTMLImageElement).src).toBe(
      new URL(value.sellers[0]!.items[0]!.thumbnail_url!, window.location.href)
        .href,
    );
    expect(image).not.toHaveAttribute("srcset");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("width", "112");
    fireEvent.error(image);
    expect(
      screen.getByRole("img", { name: "Product image unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: item.product_title })).toBeNull();
  });
  it("renders seller, option, SKU, precise currency and real destinations without free shipping", async () => {
    setup();
    render(view());
    await screen.findByText(item.product_title);
    expect(screen.getByTestId("cart-summary-total")).toHaveTextContent(
      "25.00 NPR",
    );
    expect(screen.getByRole("link", { name: "North studio" })).toHaveAttribute(
      "href",
      `/sellers/${cart.sellers[0]!.seller_id}`,
    );
    expect(
      screen.getByRole("link", { name: item.product_title }),
    ).toHaveAttribute("href", `/products/${item.product_id}`);
    expect(screen.getByText(item.variant_name)).toBeInTheDocument();
    expect(screen.getByText(`SKU: ${item.sku}`)).toBeInTheDocument();
    expect(
      screen.queryByText(/FREE|encrypted checkout|verified products/i),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /Proceed to Checkout/ }),
    ).toHaveAttribute("href", "/checkout");
  });
  it("distinguishes loading, failed read and actual empty with retry", async () => {
    const read = deferred<Response>();
    let calls = 0;
    setup((url) =>
      url === "/api/v1/cart/"
        ? ++calls === 1
          ? read.promise
          : json(empty)
        : undefined,
    );
    render(view());
    expect(screen.getByText("Loading your cart…")).toBeInTheDocument();
    expect(screen.queryByText(/currently empty/)).toBeNull();
    await act(async () => {
      read.resolve(json({ detail: "unavailable" }, 503));
    });
    await screen.findByText("We couldn’t load your cart");
    expect(screen.queryByText(/currently empty/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Your cart is currently empty");
    expect(
      screen.getByRole("link", { name: /Explore the shop/ }),
    ).toHaveAttribute("href", "/search");
    expect(calls).toBe(2);
  });
  it("keeps malformed success as error and blocks purchase", async () => {
    setup((url) =>
      url === "/api/v1/cart/"
        ? json({ ...cart, subtotal: "broken" })
        : undefined,
    );
    render(view());
    await screen.findByText("We couldn’t load your cart");
    expect(screen.queryByRole("link", { name: /Checkout/ })).toBeNull();
    expect(screen.queryByText(/currently empty/)).toBeNull();
  });
  it("serializes fast quantity clicks, shows pending and accepts only the backend amount", async () => {
    const response = deferred<Response>();
    let patches = 0;
    let options: RequestInit | undefined;
    setup((url, init) =>
      init?.method === "PATCH"
        ? (patches++, (options = init), response.promise)
        : undefined,
    );
    render(view());
    await screen.findByText(item.product_title);
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    fireEvent.click(plus);
    fireEvent.click(plus);
    await waitFor(() => expect(patches).toBe(1));
    expect(plus).toBeDisabled();
    expect(screen.getByText("Updating…")).toHaveAttribute("role", "status");
    expect(screen.getByTestId("cart-summary-total")).toHaveTextContent(
      "25.00 NPR",
    );
    expect(JSON.parse(String(options?.body))).toEqual({ quantity: 3 });
    expect(options?.credentials).toBe("include");
    expect(options?.redirect).toBe("error");
    expect(new Headers(options?.headers).get("X-CSRFToken")).toBe(csrf);
    await act(async () => {
      response.resolve(json(more));
    });
    expect(
      await screen.findByText(`Quantity updated for ${item.product_title}.`),
    ).toBeInTheDocument();
    expect(screen.getByTestId("cart-summary-total")).toHaveTextContent(
      "37.50 NPR",
    );
  });
  it("focuses rejection, retains confirmed quantity, blocks checkout and allows reload", async () => {
    setup((url, init) =>
      init?.method === "PATCH"
        ? json({ detail: "Only 2 available" }, 400)
        : undefined,
    );
    render(view());
    await screen.findByText(item.product_title);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    const error = await screen.findByText("Only 2 available");
    expect(error).toHaveFocus();
    expect(screen.getByTestId(`cart-page-qty-${item.id}`)).toHaveTextContent(
      "2",
    );
    expect(
      screen.getByRole("button", { name: /Proceed to Checkout/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reload cart" }));
    await screen.findByRole("link", { name: /Proceed to Checkout/ });
    expect(screen.queryByText("Only 2 available")).toBeNull();
  });
  it("invalidates uncertain successful mutation data rather than keeping stale checkout evidence", async () => {
    setup((url, init) =>
      init?.method === "PATCH"
        ? json({ ...more, subtotal: "99.00" })
        : undefined,
    );
    render(view());
    await screen.findByText(item.product_title);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await screen.findByText("We couldn’t load your cart");
    expect(
      screen.queryByRole("link", { name: /Proceed to Checkout/ }),
    ).toBeNull();
  });
  it("bounds stock quantities and preserves unavailable-item removal", async () => {
    setup((url) => (url === "/api/v1/cart/" ? json(out) : undefined));
    render(view());
    await screen.findByText("Out of stock");
    expect(
      screen.getByRole("button", { name: "Increase quantity" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: `Remove ${item.product_title}` }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Proceed to Checkout/ }),
    ).toBeDisabled();
  });
  it("does not remove the last quantity through a decrement", async () => {
    const one = structuredClone(cart);
    one.total_items =
      one.sellers[0]!.item_count =
      one.sellers[0]!.items[0]!.quantity =
        1;
    one.subtotal =
      one.sellers[0]!.subtotal =
      one.sellers[0]!.items[0]!.line_subtotal =
        "12.50";
    setup((url) => (url === "/api/v1/cart/" ? json(one) : undefined));
    render(view());
    await screen.findByText(item.product_title);
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
  });
  it("handles delete/clear failures instead of leaking unhandled rejections", async () => {
    setup((url, init) =>
      init?.method === "DELETE" || url.includes("/cart/clear/")
        ? json({ detail: "Cannot update now" }, 409)
        : undefined,
    );
    render(view());
    await screen.findByText(item.product_title);
    fireEvent.click(
      screen.getByRole("button", { name: `Remove ${item.product_title}` }),
    );
    expect(await screen.findByText("Cannot update now")).toHaveFocus();
    expect(screen.getByText(item.product_title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear Entire Cart" }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/cart/clear/",
        expect.any(Object),
      ),
    );
    expect(await screen.findByText("Cannot update now")).toHaveFocus();
  });
  it("moves focus to confirmed removal after the trigger disappears", async () => {
    setup((url, init) => (init?.method === "DELETE" ? json(empty) : undefined));
    render(view());
    await screen.findByText(item.product_title);
    fireEvent.click(
      screen.getByRole("button", { name: `Remove ${item.product_title}` }),
    );
    const status = await screen.findByText(`${item.product_title} removed.`);
    expect(status).toHaveFocus();
    expect(
      screen.getByText("Your cart is currently empty"),
    ).toBeInTheDocument();
  });
  it("checks explicit promo evidence without recomputing total, and clears it when cart changes", async () => {
    setup((url, init) =>
      url.includes("/promotions/validate")
        ? json({ valid: true, discount_amount: "0.01", error_message: null })
        : init?.method === "PATCH"
          ? json(more)
          : undefined,
    );
    render(view());
    await screen.findByText(item.product_title);
    fireEvent.change(screen.getByLabelText("Check a promo code"), {
      target: { value: " penny " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check code" }));
    expect(
      await screen.findByText(/is eligible for a preview discount/),
    ).toHaveTextContent("0.01 NPR");
    expect(screen.getByTestId("cart-summary-total")).toHaveTextContent(
      "25.00 NPR",
    );
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await screen.findByText(`Quantity updated for ${item.product_title}.`);
    expect(screen.queryByText(/is eligible/)).toBeNull();
    expect(screen.getByLabelText("Check a promo code")).toHaveValue("");
  });
  it("rejects invalid promo replies with a focused error", async () => {
    setup((url) =>
      url.includes("/promotions/validate")
        ? json({ valid: true, discount_amount: "26.00", error_message: null })
        : undefined,
    );
    render(view());
    await screen.findByText(item.product_title);
    fireEvent.change(screen.getByLabelText("Check a promo code"), {
      target: { value: "SAVE10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check code" }));
    const error = await screen.findByText(
      "The code preview could not be verified. Try again.",
    );
    expect(error).toHaveFocus();
    expect(screen.queryByText(/is eligible/)).toBeNull();
  });
  it("discards a late promo preview after quantity acceptance", async () => {
    const response = deferred<Response>();
    setup((url, init) =>
      url.includes("/promotions/validate")
        ? response.promise
        : init?.method === "PATCH"
          ? json(more)
          : undefined,
    );
    render(view());
    await screen.findByText(item.product_title);
    fireEvent.change(screen.getByLabelText("Check a promo code"), {
      target: { value: "SAVE10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check code" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await screen.findByText(`Quantity updated for ${item.product_title}.`);
    await act(async () => {
      response.resolve(
        json({ valid: true, discount_amount: "1.00", error_message: null }),
      );
    });
    expect(screen.queryByText(/is eligible/)).toBeNull();
  });
  it("discards obsolete Strict Mode reads even if fetch ignores cancellation", async () => {
    const old = deferred<Response>();
    let calls = 0;
    setup((url) =>
      url === "/api/v1/cart/"
        ? ++calls === 1
          ? old.promise
          : json(empty)
        : undefined,
    );
    render(<StrictMode>{view()}</StrictMode>);
    await screen.findByText("Your cart is currently empty");
    await act(async () => {
      old.resolve(json(cart));
    });
    expect(screen.queryByText(item.product_title)).toBeNull();
  });
  it("hides previous identity immediately and discards its delayed mutation", async () => {
    const response = deferred<Response>();
    let read = cart;
    setup((url, init) =>
      init?.method === "PATCH"
        ? response.promise
        : url === "/api/v1/cart/"
          ? json(read)
          : undefined,
    );
    const rendered = render(view("first"));
    await screen.findByText(item.product_title);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(item.id),
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    read = empty;
    rendered.rerender(view("second"));
    expect(screen.queryByText(item.product_title)).toBeNull();
    await screen.findByText("Your cart is currently empty");
    await act(async () => {
      response.resolve(json(more));
    });
    expect(screen.queryByText(item.product_title)).toBeNull();
    expect(screen.queryByText(/Quantity updated/)).toBeNull();
  });
  it("does not let an initial delayed read overwrite an accepted add", async () => {
    const old = deferred<Response>();
    setup((url, init) =>
      url === "/api/v1/cart/"
        ? old.promise
        : init?.method === "POST" && url.includes("/cart/items/")
          ? json(more, 201)
          : undefined,
    );
    render(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(screen.getByTestId("cart-read")).toHaveTextContent(
        "ready:37.50:idle",
      ),
    );
    await act(async () => {
      old.resolve(json(cart));
    });
    expect(screen.getByTestId("cart-read")).toHaveTextContent(
      "ready:37.50:idle",
    );
  });
  it("binds production cart reads to auth identity without remounting unrelated content", async () => {
    setup((url) => (url.includes("/auth/me") ? json(user) : undefined));
    const mounted = vi.fn();
    function Child() {
      useEffect(() => {
        mounted();
      }, []);
      return <Probe />;
    }
    render(
      <AuthProvider>
        <SessionCartProvider>
          <Child />
        </SessionCartProvider>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("cart-read")).toHaveTextContent(
        "ready:25.00:idle",
      ),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/cart/",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        redirect: "error",
      }),
    );
    expect(mounted).toHaveBeenCalledTimes(1);
  });
  it("uses the native dialog, restores focus on close, and targets checkout", async () => {
    setup();
    render(view());
    await screen.findByText(item.product_title);
    const trigger = screen.getByRole("button", { name: /shopping cart/i });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Shopping Cart Drawer" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(
      within(dialog).getByRole("button", { name: "Close cart" }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole("link", { name: /Proceed to Checkout/ }),
    ).toHaveAttribute("href", "/checkout");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close cart" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
