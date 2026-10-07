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
import Home from "@/app/page";
import { json } from "./fixtures";
import type {
  StorefrontCategory,
  StorefrontProductCard,
} from "@/lib/api/types";

vi.mock("@/features/storefront/header", () => ({
  StorefrontHeader: () => <header>Customer navigation</header>,
}));
vi.mock("@/features/storefront/footer", () => ({
  StorefrontFooter: () => <footer>Customer footer</footer>,
}));
const category: StorefrontCategory = {
  id: "60000000-0000-4000-8000-000000000037",
  name: "Lighting",
  slug: "lighting",
  description: "",
  parent_id: null,
  product_count: 3,
};
const product: StorefrontProductCard = {
  id: "80000000-0000-4000-8000-000000000037",
  title: "Reading lamp",
  slug: "reading-lamp",
  short_description: "",
  category_id: category.id,
  category_name: category.name,
  brand_id: null,
  brand_name: null,
  starting_price: "9007199254740993.25",
  compare_at_price: "9007199254740994.00",
  currency: "NPR",
  thumbnail_url: null,
  in_stock: true,
  average_rating: null,
  review_count: 0,
  seller: {
    id: "30000000-0000-4000-8000-000000000037",
    name: "Oak Studio",
    store_name: "Oak Studio",
    rating: null,
  },
};
const envelope = (
  results: StorefrontProductCard[] = [product],
  count = results.length,
) => ({ count, next: null, previous: null, results });
function fetchEvidence(
  categories: unknown = [category],
  catalog: unknown = envelope(),
) {
  return vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(
      json(String(input).includes("/categories") ? categories : catalog),
    ),
  );
}
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubGlobal("fetch", fetchEvidence());
});

describe("Phase 37 homepage", () => {
  it("composes shopping sections with genuine destinations and exact currency without invented claims", async () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Good finds.*Independent shops/,
      }),
    ).toBeInTheDocument();
    const arrivals = screen.getByRole("region", { name: "New on the shelves" });
    expect(
      await within(arrivals).findByRole("heading", { name: "Reading lamp" }),
    ).toBeInTheDocument();
    expect(
      within(arrivals).getByText("9,007,199,254,740,993.25 NPR"),
    ).toBeInTheDocument();
    expect(within(arrivals).getByLabelText("Previous price")).toHaveTextContent(
      "9,007,199,254,740,994.00 NPR",
    );
    expect(
      screen.getByRole("link", { name: "Shop new arrivals" }),
    ).toHaveAttribute("href", "/search?sort=newest");
    expect(
      screen.getByRole("link", { name: /Lighting 3 products/ }),
    ).toHaveAttribute("href", `/categories/${category.id}`);
    expect(
      within(arrivals).getByRole("link", { name: "View Reading lamp" }),
    ).toHaveAttribute("href", `/products/${product.id}`);
    expect(
      screen.getByRole("link", { name: "Become a seller" }),
    ).toHaveAttribute("href", "/onboarding");
    expect(
      screen.queryByText(/Know the shop|See the price|Look a little closer/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute(
      "id",
      "storefront-content",
    );
    expect(
      screen.queryByText(
        /verified|free shipping|fast regional|trending|thousands|100%|0 of 0/i,
      ),
    ).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).toEqual(
      [
        "/api/v1/storefront/categories",
        "/api/v1/storefront/products?sort=newest",
      ],
    );
  });

  it("shows honest empty catalog/category/seller states without fabricated merchandise", async () => {
    vi.stubGlobal("fetch", fetchEvidence([], envelope([])));
    render(<Home />);
    expect(
      await screen.findByText("Nothing on the shelves yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Categories will appear here as the catalog grows."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Seller stores will appear here with their published products.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Reading lamp")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/0 of 0|verified|free shipping/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore the shops" }),
    ).toHaveAttribute("href", "#sellers");
    expect(document.getElementById("sellers")).toBeInTheDocument();
  });

  it("keeps categories available on catalog failure and retries genuinely rather than claiming an empty success", async () => {
    const fetcher = fetchEvidence();
    let failed = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (!String(input).includes("/categories") && failed) {
          failed = false;
          return Promise.resolve(json({ detail: "Unavailable" }, 503));
        }
        return fetcher(input);
      }),
    );
    render(<Home />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t load the latest arrivals.",
    );
    expect(
      screen.getByRole("link", { name: /Lighting 3 products/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nothing on the shelves yet."),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry latest arrivals" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Reading lamp" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("preserves products on category failure and provides independent retry", async () => {
    const fetcher = fetchEvidence();
    let failed = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).includes("/categories") && failed) {
          failed = false;
          return Promise.reject(new Error("Offline"));
        }
        return fetcher(input);
      }),
    );
    render(<Home />);
    expect(
      await screen.findByText("Categories are unavailable right now."),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Reading lamp" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry categories" }));
    expect(
      await screen.findByRole("link", { name: /Lighting 3 products/ }),
    ).toBeInTheDocument();
  });

  it("bounds merchandise and seller previews and never invents counts or ratings from their sample", async () => {
    const products = Array.from({ length: 12 }, (_, index) => ({
      ...product,
      id: `80000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      title: `Lamp ${index}`,
      seller: {
        ...product.seller,
        id: `30000000-0000-4000-8000-${String(index % 6).padStart(12, "0")}`,
        name: `Shop ${index % 6}`,
        store_name: `Shop ${index % 6}`,
      },
    }));
    vi.stubGlobal("fetch", fetchEvidence([category], envelope(products, 99)));
    render(<Home />);
    const arrivals = screen.getByRole("region", { name: "New on the shelves" });
    await within(arrivals).findByRole("heading", { name: "Lamp 0" });
    expect(within(arrivals).getAllByRole("article")).toHaveLength(8);
    const shops = screen.getByRole("region", { name: "Meet the shops" });
    expect(within(shops).getAllByRole("link")).toHaveLength(4);
    expect(
      within(shops).getByText("Stores represented in the latest arrivals."),
    ).toBeInTheDocument();
    expect(
      within(shops).queryByText(/verified|rated|products/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/^99(?: products| items| sellers)?$/),
    ).not.toBeInTheDocument();
  });

  it.each([
    { ...product, starting_price: 1.2 },
    { ...product, thumbnail_url: "https://example.com/private.jpg" },
    { ...product, id: "../../admin" },
  ])(
    "rejects malformed monetary/media/identity evidence as visible failure",
    async (malformed) => {
      vi.stubGlobal(
        "fetch",
        fetchEvidence([category], { count: 1, results: [malformed] }),
      );
      render(<Home />);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "We couldn’t load the latest arrivals.",
      );
      expect(
        screen.queryByText("Nothing on the shelves yet."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Reading lamp" }),
      ).not.toBeInTheDocument();
    },
  );

  it("discards canceled Strict Mode responses and ignores their late rejection", async () => {
    const stale = deferred();
    const fetcher = fetchEvidence();
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (!String(input).includes("/categories") && first) {
          first = false;
          return stale.promise;
        }
        return fetcher(input);
      }),
    );
    render(
      <StrictMode>
        <Home />
      </StrictMode>,
    );
    expect(
      await screen.findByRole("heading", { name: "Reading lamp" }),
    ).toBeInTheDocument();
    const firstRequest = vi
      .mocked(fetch)
      .mock.calls.find(([input]) => String(input).includes("/products"));
    expect(firstRequest?.[1]?.signal?.aborted).toBe(true);
    await act(async () => stale.resolve(json({ detail: "Old error" }, 503)));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reading lamp" }),
    ).toBeInTheDocument();
  });

  it("cancels public reads when leaving the homepage", async () => {
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const view = render(<Home />);
    const signals = vi
      .mocked(fetch)
      .mock.calls.map(([, options]) => options?.signal);
    view.unmount();
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
    await act(async () => pending.resolve(json(envelope())));
    await waitFor(() =>
      expect(screen.queryByRole("main")).not.toBeInTheDocument(),
    );
  });
});
