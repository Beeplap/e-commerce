import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductDetailPage } from "@/features/storefront/detail/page";
import { ProductDetailView } from "@/features/storefront/product-detail-view";
import { ProductGallery } from "@/features/storefront/detail/gallery";
import {
  detailEvidence,
  previousPrice,
} from "@/features/storefront/detail/evidence";
import { ApiError } from "@/lib/api/client";
import type { StorefrontProductDetail } from "@/lib/api/types";
import { json } from "./fixtures";

const cart = vi.hoisted(() => ({
  addItem: vi.fn<(...args: unknown[]) => Promise<void>>(),
}));
const auth = vi.hoisted(() => ({ identity: "anonymous" }));
vi.mock("@/features/cart/cart-context", () => ({ useCart: () => cart }));
vi.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    state:
      auth.identity === "anonymous"
        ? { kind: "anonymous" }
        : { kind: "authenticated", user: { id: auth.identity } },
  }),
}));
vi.mock("@/features/storefront/header", () => ({
  StorefrontHeader: () => <header>Storefront</header>,
}));
vi.mock("@/features/storefront/footer", () => ({
  StorefrontFooter: () => <footer>Footer</footer>,
}));

const id = "80000000-0000-4000-8000-000000000039";
const otherId = "80000000-0000-4000-8000-000000000040";
const categoryId = "60000000-0000-4000-8000-000000000039";
const sellerId = "30000000-0000-4000-8000-000000000039";
const imageId = "90000000-0000-4000-8000-000000000039";
export const detailProduct: StorefrontProductDetail = {
  id,
  title: "Studio headphones",
  slug: "studio-headphones",
  description: "A detailed description.\nSecond paragraph.",
  short_description: "Over-ear headphones.",
  category: {
    id: categoryId,
    name: "Audio",
    slug: "audio",
    description: "",
    parent_id: null,
    product_count: 2,
  },
  brand: null,
  seller: {
    id: sellerId,
    name: "Sound Shop",
    store_name: "Sound Shop",
    rating: null,
  },
  starting_price: "25.10",
  compare_at_price: "30.00",
  currency: "NPR",
  in_stock: true,
  total_available_stock: 5,
  average_rating: 5,
  review_count: 1,
  rating_breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 },
  images: [
    {
      id: imageId,
      url: `/api/v1/storefront/products/${id}/images/${imageId}/`,
      alt_text: "Headphones from the front",
      sort_order: 0,
    },
  ],
  variants: [
    {
      id: "a0000000-0000-4000-8000-000000000039",
      sku: "HEAD-BLK",
      price: "25.10",
      compare_at_price: "30.00",
      in_stock: true,
      available_quantity: 3,
      attributes: { color: "Black" },
    },
    {
      id: "a0000000-0000-4000-8000-000000000040",
      sku: "HEAD-WHT",
      price: "30.10",
      compare_at_price: null,
      in_stock: true,
      available_quantity: 2,
      attributes: { color: "White" },
    },
    {
      id: "a0000000-0000-4000-8000-000000000041",
      sku: "HEAD-RED",
      price: "31.10",
      compare_at_price: null,
      in_stock: false,
      available_quantity: 0,
      attributes: { color: "Red" },
    },
  ],
  recent_reviews: [
    {
      id: "b0000000-0000-4000-8000-000000000039",
      customer_name: "S***",
      rating: 5,
      title: "Great sound",
      body: "Comfortable.",
      verified_purchase: false,
      created_at: "2026-09-30T23:30:00-05:00",
      seller_response: "Thank you!",
      seller_response_at: "2026-10-01T12:00:00Z",
    },
  ],
};
const fresh = () => structuredClone(detailProduct);
const page = (products: unknown[] = []) => ({
  count: products.length,
  results: products,
  next: null,
  previous: null,
});
const card = (productId = otherId) => ({
  id: productId,
  title: "Another headphone",
  slug: "another",
  short_description: "",
  category_id: categoryId,
  category_name: "Audio",
  brand_id: null,
  brand_name: null,
  starting_price: "9007199254740993.01",
  compare_at_price: null,
  currency: "NPR",
  thumbnail_url: null,
  in_stock: true,
  average_rating: null,
  review_count: 0,
  seller: detailProduct.seller,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  auth.identity = "anonymous";
  cart.addItem.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes(`products/${id}`) ? json(fresh()) : json(page()),
    ),
  );
});

describe("Product detail runtime evidence", () => {
  it("accepts the public contract with exact price strings and no invented verification", () => {
    const value = detailEvidence(fresh(), id.toUpperCase());
    expect(value.variants[0]?.price).toBe("25.10");
    expect(value.seller).not.toHaveProperty("verified");
  });
  it.each([
    [
      "foreign product",
      (p: StorefrontProductDetail) => {
        p.id = otherId;
      },
    ],
    [
      "float price",
      (p: StorefrontProductDetail) => {
        Object.assign(p, { starting_price: 25.1 });
      },
    ],
    [
      "currency",
      (p: StorefrontProductDetail) => {
        p.currency = "USD<script>";
      },
    ],
    [
      "external image",
      (p: StorefrontProductDetail) => {
        p.images[0]!.url = "https://outside.example/image.png";
      },
    ],
    [
      "foreign image",
      (p: StorefrontProductDetail) => {
        p.images[0]!.url = `/api/v1/storefront/products/${otherId}/images/${imageId}/`;
      },
    ],
    [
      "duplicate images",
      (p: StorefrontProductDetail) => {
        p.images.push(p.images[0]!);
      },
    ],
    [
      "duplicate variants",
      (p: StorefrontProductDetail) => {
        p.variants.push(p.variants[0]!);
      },
    ],
    [
      "negative stock",
      (p: StorefrontProductDetail) => {
        p.variants[0]!.available_quantity = -1;
      },
    ],
    [
      "fractional stock",
      (p: StorefrontProductDetail) => {
        p.variants[0]!.available_quantity = 0.5;
      },
    ],
    [
      "stock contradiction",
      (p: StorefrontProductDetail) => {
        p.variants[0]!.in_stock = false;
      },
    ],
    [
      "bad attributes",
      (p: StorefrontProductDetail) => {
        Object.assign(p.variants[0]!, { attributes: { color: {} } });
      },
    ],
    [
      "aggregate contradiction",
      (p: StorefrontProductDetail) => {
        p.total_available_stock = 100;
      },
    ],
    [
      "bad rating",
      (p: StorefrontProductDetail) => {
        p.average_rating = 8;
      },
    ],
    [
      "bad breakdown",
      (p: StorefrontProductDetail) => {
        p.rating_breakdown["5"] = 100;
      },
    ],
    [
      "invalid date",
      (p: StorefrontProductDetail) => {
        p.recent_reviews[0]!.created_at = "yesterday";
      },
    ],
    [
      "bad purchase evidence",
      (p: StorefrontProductDetail) => {
        Object.assign(p.recent_reviews[0]!, { verified_purchase: "true" });
      },
    ],
  ])("rejects %s before rendering purchase data", (_name, mutate) => {
    const product = fresh();
    mutate(product);
    expect(() => detailEvidence(product, id)).toThrow();
  });
  it("bounds gallery, options and reviews without silently dropping options", () => {
    for (const [field, count] of [
      ["images", 11],
      ["variants", 1001],
      ["recent_reviews", 11],
    ] as const) {
      const product = fresh();
      Object.assign(product, {
        [field]: Array.from({ length: count }, () => product[field][0]),
      });
      expect(() => detailEvidence(product, id)).toThrow();
    }
  });
  it("compares previous prices exactly above Number.MAX_SAFE_INTEGER", () => {
    expect(previousPrice("9007199254740993.01", "9007199254740993.02")).toBe(
      "9007199254740993.02",
    );
    expect(
      previousPrice("9007199254740993.02", "9007199254740993.01"),
    ).toBeNull();
    expect(previousPrice("1.00", "1")).toBeNull();
  });
});

describe("Public product loading", () => {
  it("uses the existing same-origin request and a single shell with retry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ detail: "Private exception" }, 503),
    );
    render(<ProductDetailPage id={id} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading product");
    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t load this product",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Private exception")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: detailProduct.title }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/storefront/products/${id}`,
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it("invalid IDs never request product data; missing products offer recovery", async () => {
    const view = render(<ProductDetailPage id="../../secrets" />);
    expect(
      screen.getByRole("heading", { name: "Product unavailable" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValueOnce(json({ detail: "Missing" }, 404));
    view.rerender(<ProductDetailPage id={id} />);
    expect(
      await screen.findByRole("heading", { name: "Product unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Browse the shop/ }),
    ).toHaveAttribute("href", "/search");
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
  it("malformed successful responses stay errors and expose no cart control", async () => {
    const product = fresh();
    product.variants[0]!.price = "NaN";
    vi.mocked(fetch).mockResolvedValueOnce(json(product));
    render(<ProductDetailPage id={id} />);
    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add to cart" }),
    ).not.toBeInTheDocument();
  });
  it("discards late products after route change and invalidates old records immediately", async () => {
    const old = deferred<Response>();
    const current = deferred<Response>();
    vi.mocked(fetch).mockImplementation((input) =>
      String(input).endsWith(id) ? old.promise : current.promise,
    );
    const view = render(<ProductDetailPage id={id} />);
    const oldSignal = vi.mocked(fetch).mock.calls[0]![1]!.signal!;
    view.rerender(<ProductDetailPage id={otherId} />);
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      old.resolve(json(fresh()));
    });
    expect(
      screen.queryByRole("heading", { name: detailProduct.title }),
    ).not.toBeInTheDocument();
    const value = fresh();
    value.id = otherId;
    value.images = [];
    value.title = "Current product";
    await act(async () => {
      current.resolve(json(value));
    });
    expect(
      screen.getByRole("heading", { name: "Current product" }),
    ).toBeInTheDocument();
    view.rerender(<ProductDetailPage id={id} />);
    expect(
      screen.queryByRole("heading", { name: "Current product" }),
    ).not.toBeInTheDocument();
  });
  it("ignores Strict Mode canceled failures without poisoning the current read", async () => {
    const canceled = deferred<Response>();
    vi.mocked(fetch)
      .mockResolvedValue(json(fresh()))
      .mockImplementationOnce(() => canceled.promise);
    render(
      <StrictMode>
        <ProductDetailPage id={id} />
      </StrictMode>,
    );
    expect(
      await screen.findByRole("heading", { name: detailProduct.title }),
    ).toBeInTheDocument();
    await act(async () => {
      canceled.reject(new DOMException("Canceled", "AbortError"));
    });
    expect(
      screen.queryByText("We couldn’t load this product"),
    ).not.toBeInTheDocument();
  });
  it("discards purchase feedback when the authenticated identity changes", async () => {
    const pending = deferred<void>();
    cart.addItem.mockReturnValue(pending.promise);
    const view = render(<ProductDetailPage id={id} />);
    await screen.findByRole("heading", { name: detailProduct.title });
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    auth.identity = "another-user";
    view.rerender(<ProductDetailPage id={id} />);
    expect(screen.getByText("Loading product…")).toBeInTheDocument();
    await screen.findByRole("heading", { name: detailProduct.title });
    await act(async () => {
      pending.resolve();
    });
    expect(screen.queryByText(/added to cart/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to cart" }),
    ).not.toBeDisabled();
  });
});

describe("Gallery, choices and truthful purchase feedback", () => {
  it("handles image loading, missing photographs, failure and accessible multi-image selection", async () => {
    const second = {
      ...detailProduct.images[0]!,
      id: otherId,
      url: `/api/v1/storefront/products/${id}/images/${otherId}/`,
      alt_text: "Side view",
    };
    const view = render(
      <ProductGallery
        title={detailProduct.title}
        images={[detailProduct.images[0]!, second]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading image");
    const image = screen.getByAltText("Headphones from the front");
    fireEvent.load(image);
    expect(image).toHaveAttribute("data-loaded", "true");
    fireEvent.click(
      screen.getByRole("button", { name: "View image 2: Side view" }),
    );
    expect(
      screen.getByRole("button", { name: "View image 2: Side view" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.error(screen.getByAltText("Side view"));
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
    view.rerender(<ProductGallery title={detailProduct.title} images={[]} />);
    expect(screen.getByText("Product image unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("uses stock bounds, resets quantity on option change and allows inspecting unavailable options", () => {
    render(<ProductDetailView product={fresh()} />);
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(plus).toBeDisabled();
    expect(screen.getByTestId("selected-quantity")).toHaveTextContent("3");
    fireEvent.click(screen.getByRole("button", { name: /White/ }));
    expect(screen.getByTestId("selected-quantity")).toHaveTextContent("1");
    expect(screen.getAllByText("30.10 NPR")[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Red.*Out of stock/ }));
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(plus).toBeDisabled();
    expect(screen.getByText("This option is out of stock")).toBeInTheDocument();
    expect(screen.getByText("HEAD-RED")).toBeInTheDocument();
  });
  it("chooses an available option first and disables products without options", () => {
    const product = fresh();
    product.variants[0]!.in_stock = false;
    product.variants[0]!.available_quantity = 0;
    const view = render(<ProductDetailView product={product} />);
    expect(screen.getByRole("button", { name: /White/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    view.rerender(
      <ProductDetailView product={{ ...product, id: otherId, variants: [] }} />,
    );
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(
      screen.getByText("No purchasable options available"),
    ).toBeInTheDocument();
  });
  it("blocks duplicate submission, waits for acceptance and keeps selection fixed while pending", async () => {
    const pending = deferred<void>();
    cart.addItem.mockReturnValue(pending.promise);
    render(<ProductDetailView product={fresh()} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    const button = screen.getByRole("button", { name: "Add to cart" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(cart.addItem).toHaveBeenCalledTimes(1);
    expect(cart.addItem).toHaveBeenCalledWith(detailProduct.variants[0]!.id, 2);
    expect(screen.queryByText(/added to cart/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /White/ })).toBeDisabled();
    await act(async () => {
      pending.resolve();
    });
    expect(screen.getByText(/2 items added to cart\./)).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByRole("link", { name: "View cart" })).toHaveAttribute(
      "href",
      "/cart",
    );
    expect(button).not.toBeDisabled();
  });
  it("preserves quantity on rejected mutation, shows the real error and allows retry", async () => {
    cart.addItem.mockRejectedValueOnce(new ApiError("Not enough stock.", 400));
    render(<ProductDetailView product={fresh()} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Not enough stock.",
    );
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByTestId("selected-quantity")).toHaveTextContent("2");
    expect(screen.queryByText(/added to cart/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByText(/2 items added to cart/)).toHaveAttribute(
      "role",
      "status",
    );
  });
  it("does not expose raw unexpected errors or let old completion affect another product", async () => {
    const pending = deferred<void>();
    cart.addItem.mockReturnValue(pending.promise);
    const view = render(<ProductDetailView product={fresh()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    view.rerender(
      <ProductDetailView
        product={{ ...fresh(), id: otherId, title: "Other product" }}
      />,
    );
    await act(async () => {
      pending.reject(new Error("Internal session details"));
    });
    expect(
      screen.queryByText(/Internal session|added to cart/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to cart" }),
    ).not.toBeDisabled();
  });
  it("uses real seller/brand destinations, conditional purchase badges and UTC review dates", () => {
    const product = fresh();
    product.brand = {
      id: imageId,
      name: "Sound brand",
      slug: "sound",
      product_count: 1,
    };
    render(<ProductDetailView product={product} />);
    expect(screen.getByRole("link", { name: "Sound brand" })).toHaveAttribute(
      "href",
      `/search?brand=${imageId}`,
    );
    expect(screen.getByRole("link", { name: "Sound Shop" })).toHaveAttribute(
      "href",
      `/sellers/${sellerId}`,
    );
    expect(
      screen.queryByText(
        /Verified seller|Verified purchase|ready to ship|reservations active|tomorrow/,
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Seller response")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Buy now/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("meter", { name: "5 star ratings" }),
    ).toHaveAttribute("value", "1");
  });
  it("shows a verified-purchase label only for a true review flag and safely renders plain text", () => {
    const product = fresh();
    product.recent_reviews[0]!.verified_purchase = true;
    product.description = "<script>attack()</script>";
    render(<ProductDetailView product={product} />);
    expect(screen.getByText("Verified purchase")).toBeInTheDocument();
    expect(screen.getByText("<script>attack()</script>")).toBeInTheDocument();
    expect(
      document.querySelector("main script, .sf-pdp-container script"),
    ).toBeNull();
  });
  it("shows precise huge amounts and omits previous prices which are not higher", () => {
    const product = fresh();
    product.variants[0]!.price = "9007199254740993.01";
    product.variants[0]!.compare_at_price = "9007199254740993.00";
    render(<ProductDetailView product={product} />);
    expect(
      screen.getAllByText("9,007,199,254,740,993.01 NPR")[0],
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Previous price")).not.toBeInTheDocument();
  });
  it("related products exclude the current item, preserve exact prices and never follow pagination URLs", async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({
        ...page([card(id), card()]),
        next: "https://outside.example/api",
      }),
    );
    render(<ProductDetailView product={fresh()} />);
    expect(
      await screen.findByRole("heading", { name: "Another headphone" }),
    ).toBeInTheDocument();
    const related = screen.getByRole("region", { name: "More in Audio" });
    expect(within(related).getAllByRole("article")).toHaveLength(1);
    expect(
      within(related).getByText("9,007,199,254,740,993.01 NPR"),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/storefront/products?category=${categoryId}&sort=newest`,
      expect.anything(),
    );
  });
  it("related failures retry independently without disabling purchase; zero results stay honest", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json(page([{ ...card(), category_id: sellerId }])),
    );
    render(<ProductDetailView product={fresh()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Related products couldn’t be loaded",
    );
    expect(
      screen.getByRole("button", { name: "Add to cart" }),
    ).not.toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry related products" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/no other products to show/)).toBeInTheDocument(),
    );
  });
});
