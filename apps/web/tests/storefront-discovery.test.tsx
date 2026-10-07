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
import { DiscoveryPage } from "@/features/storefront/discovery/page";
import { discoveryEvidence } from "@/features/storefront/discovery/evidence";
import {
  discoveryHref,
  filterChips,
  readDiscoveryQuery,
  validPriceRange,
} from "@/features/storefront/discovery/query";
import { SearchFiltersSidebar } from "@/features/storefront/search-filters";
import type {
  StorefrontProductCard,
  StorefrontSearchResultPage,
} from "@/lib/api/types";
import { json } from "./fixtures";

const categoryId = "60000000-0000-4000-8000-000000000001";
const brandId = "70000000-0000-4000-8000-000000000001";
const sellerId = "30000000-0000-4000-8000-000000000001";
const product: StorefrontProductCard = {
  id: "80000000-0000-4000-8000-000000000001",
  title: "Actual headphones",
  slug: "headphones",
  short_description: "",
  category_id: categoryId,
  category_name: "Audio",
  brand_id: brandId,
  brand_name: "Apex",
  starting_price: "9007199254740993.09",
  compare_at_price: null,
  currency: "NPR",
  thumbnail_url: null,
  in_stock: false,
  average_rating: null,
  review_count: 0,
  seller: {
    id: sellerId,
    name: "Actual shop",
    store_name: "Actual shop",
    rating: null,
  },
};
const category = {
  id: categoryId,
  name: "Audio",
  slug: "audio",
  description: "Actual category description",
  parent_id: null,
  product_count: 21,
};
const page = (): StorefrontSearchResultPage => ({
  count: 21,
  next: "https://untrusted.example/page",
  previous: null,
  results: [product],
  facets: {
    categories: [{ id: categoryId, name: "Audio", slug: "audio", count: 21 }],
    brands: [{ id: brandId, name: "Apex", slug: "apex", count: 21 }],
    in_stock_count: 0,
    price_brackets: [
      { label: "Under $50", min_price: "0", max_price: "50", count: 0 },
    ],
    rating_brackets: [{ min_rating: 4, label: "4 stars & above", count: 0 }],
  },
});
let params = new URLSearchParams();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));
vi.mock("@/features/storefront/header", () => ({
  StorefrontHeader: () => <header>Catalog header</header>,
}));
vi.mock("@/features/storefront/footer", () => ({
  StorefrontFooter: () => <footer>Catalog footer</footer>,
}));
function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}
function respond(result = page(), categories: unknown = [category]) {
  vi.mocked(fetch).mockImplementation((input) =>
    Promise.resolve(
      json(requestUrl(input).includes("/categories") ? categories : result),
    ),
  );
}
beforeEach(() => {
  params = new URLSearchParams();
  push.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

describe("discovery URL and evidence boundaries", () => {
  it("canonicalizes case-insensitive UUID filters and category route identity", () => {
    const id = "60000000-0000-4000-8000-abcdefabcdef";
    expect(
      readDiscoveryQuery(
        new URLSearchParams({ category: id.toUpperCase() }),
        id.toUpperCase(),
      ).filters.category,
    ).toBe(id);
  });
  it("round trips the complete allowlisted search without following pagination URLs", () => {
    const url = `q=Audio&category=${categoryId}&brand=${brandId}&seller=${sellerId}&min_price=9007199254740993.09&max_price=9007199254740993.10&in_stock=yes&min_rating=4.5&sort=price_asc&page=2&limit=20`;
    const query = readDiscoveryQuery(new URLSearchParams(url));
    const dest = discoveryHref(query);
    expect(dest).toBe(
      `/search?q=Audio&category=${categoryId}&brand=${brandId}&seller=${sellerId}&min_price=9007199254740993.09&max_price=9007199254740993.10&in_stock=true&min_rating=4.5&sort=price_asc&page=2`,
    );
    expect(readDiscoveryQuery(new URLSearchParams(dest.split("?")[1]))).toEqual(
      query,
    );
  });
  it("locks category routes, preserves slugs and matches printable query normalization", () => {
    const query = readDiscoveryQuery(
      new URLSearchParams("q=%00++sound++&brand_slug=apex&page=2"),
      categoryId,
    );
    expect(query.query).toBe("sound");
    expect(query.filters.category).toBe(categoryId);
    expect(discoveryHref(query, categoryId)).toBe(
      `/categories/${categoryId}?q=sound&brand_slug=apex&page=2`,
    );
    expect(
      readDiscoveryQuery(new URLSearchParams({ q: "😀".repeat(101) })).query,
    ).toBe("😀".repeat(100));
  });
  it.each([
    "page=0",
    "page=1x",
    "page=-1",
    "page=99999999999999999",
    "sort=random",
    "category=bad",
    "brand=bad",
    "seller=bad",
    "brand_slug=../x",
    "min_price=-1",
    "min_price=1e3",
    "min_price=2&max_price=1",
    "min_rating=6",
    "min_rating=NaN",
    "in_stock=maybe",
    "limit=50",
    "sort=newest&sort=rating",
    "redirect=https://example.com",
  ])("rejects invalid address %s", (query) => {
    expect(() => readDiscoveryQuery(new URLSearchParams(query))).toThrow();
  });
  it("rejects conflicts with category identity", () => {
    expect(() =>
      readDiscoveryQuery(
        new URLSearchParams("category_slug=audio"),
        categoryId,
      ),
    ).toThrow();
    expect(() =>
      readDiscoveryQuery(
        new URLSearchParams(`category=${brandId}`),
        categoryId,
      ),
    ).toThrow();
    expect(() => readDiscoveryQuery(new URLSearchParams(), "bad")).toThrow();
  });
  it("compares decimal prices without rounding, bounds allocation and preserves open ranges", () => {
    expect(validPriceRange("9007199254740993.10", "9007199254740993.09")).toBe(
      false,
    );
    expect(validPriceRange("9007199254740993.09", "9007199254740993.10")).toBe(
      true,
    );
    expect(validPriceRange("0001.000", "1")).toBe(true);
    expect(validPriceRange("1", "")).toBe(true);
    expect(validPriceRange("9".repeat(129))).toBe(false);
  });
  it.each([
    (value: StorefrontSearchResultPage) => {
      value.results[0]!.starting_price = "NaN";
    },
    (value: StorefrontSearchResultPage) => {
      value.results[0]!.thumbnail_url = "https://tracker.example/a.png";
    },
    (value: StorefrontSearchResultPage) => {
      value.results[0]!.thumbnail_url = `/api/v1/storefront/products/${brandId}/images/${categoryId}/`;
    },
    (value: StorefrontSearchResultPage) => {
      value.results[0]!.seller.id = "bad";
    },
    (value: StorefrontSearchResultPage) => {
      value.results[0]!.average_rating = 6;
    },
    (value: StorefrontSearchResultPage) => {
      value.results.push(value.results[0]!);
    },
    (value: StorefrontSearchResultPage) => {
      value.facets.categories.push(value.facets.categories[0]!);
    },
    (value: StorefrontSearchResultPage) => {
      value.facets.price_brackets[0]!.max_price = "-1";
    },
    (value: StorefrontSearchResultPage) => {
      value.facets.price_brackets[0]!.min_price = "51";
    },
    (value: StorefrontSearchResultPage) => {
      value.facets.rating_brackets[0]!.min_rating = NaN;
    },
    (value: StorefrontSearchResultPage) => {
      value.count = -1;
    },
    (value: StorefrontSearchResultPage) => {
      value.results = Array.from({ length: 21 }, () => value.results[0]!);
    },
  ])("rejects malformed consumed API evidence %#", (mutate) => {
    const value = structuredClone(page());
    mutate(value);
    expect(() => discoveryEvidence(value)).toThrow();
  });
  it("keeps removable filters even without facets; never offers removing locked category identity", () => {
    const filters = {
      category: categoryId,
      brand: brandId,
      seller: sellerId,
      min_price: "0",
      min_rating: 4,
      in_stock: true,
    };
    expect(filterChips(filters, null)).toHaveLength(6);
    expect(filterChips(filters, null, categoryId)).toHaveLength(5);
    expect(filterChips(filters, null)[0]!.clear.category).toBeUndefined();
  });
});

describe("discovery integration", () => {
  it("marks slug-selected facets and removes the selected slug without substituting a UUID", () => {
    const change = vi.fn();
    render(
      <SearchFiltersSidebar
        facets={page().facets}
        filters={{ category_slug: "audio", brand_slug: "apex" }}
        onFilterChange={change}
      />,
    );
    const brand = screen.getByRole("button", {
      name: "Apex: 21 products before filters",
    });
    expect(brand).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Audio: 21 products before filters" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(brand);
    expect(change).toHaveBeenCalledWith({
      category_slug: "audio",
      brand_slug: undefined,
      brand: undefined,
    });
  });
  it("displays real sellers, exact currencies and stock without inventing reviews or shipping", async () => {
    respond();
    render(<DiscoveryPage />);
    expect(
      await screen.findByRole("heading", { name: product.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("9,007,199,254,740,993.09 NPR"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Actual shop" })).toHaveAttribute(
      "href",
      `/sellers/${sellerId}`,
    );
    expect(screen.getByText("Currently out of stock")).toBeInTheDocument();
    expect(
      screen.queryByText(/ready to ship|verified|free shipping|best seller/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/search?page=2",
    );
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });
  it("preserves every filter in local pagination and resets page on sort", async () => {
    params = new URLSearchParams(
      `q=Audio&brand=${brandId}&seller=${sellerId}&min_price=10&max_price=50&in_stock=true&min_rating=4&sort=rating&page=2`,
    );
    const result = page();
    result.count = 41;
    respond(result);
    render(<DiscoveryPage />);
    await screen.findByRole("heading", { name: product.title });
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      `/search?q=Audio&brand=${brandId}&seller=${sellerId}&min_price=10&max_price=50&in_stock=true&min_rating=4&sort=rating&page=3`,
    );
    fireEvent.change(screen.getByLabelText("Sort:"), {
      target: { value: "price_asc" },
    });
    expect(push).toHaveBeenCalledWith(
      `/search?q=Audio&brand=${brandId}&seller=${sellerId}&min_price=10&max_price=50&in_stock=true&min_rating=4&sort=price_asc`,
      { scroll: false },
    );
    const url = new URL(
      String(
        vi
          .mocked(fetch)
          .mock.calls.find(([input]) =>
            requestUrl(input).includes("/search"),
          )![0],
      ),
      "http://local",
    );
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("limit")).toBe("20");
  });
  it("uses category metadata and category-scoped search with paginated destinations", async () => {
    respond();
    render(<DiscoveryPage categoryId={categoryId} />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Audio" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      `/categories/${categoryId}?page=2`,
    );
    expect(
      screen.queryByRole("group", { name: "Categories" }),
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([input]) =>
          requestUrl(input).includes(`category=${categoryId}`),
        ),
    ).toBe(true);
  });
  it("keeps products visible when metadata fails and retries metadata independently", async () => {
    let categoriesFailed = true;
    vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(
        json(
          requestUrl(input).includes("/categories")
            ? categoriesFailed
              ? { detail: "Unavailable" }
              : [category]
            : page(),
          requestUrl(input).includes("/categories") && categoriesFailed
            ? 503
            : 200,
        ),
      ),
    );
    render(<DiscoveryPage categoryId={categoryId} />);
    await screen.findByRole("heading", { name: product.title });
    expect(
      await screen.findByText("Category details are unavailable."),
    ).toBeInTheDocument();
    categoriesFailed = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Retry category details" }),
    );
    await screen.findByRole("heading", { level: 1, name: "Audio" });
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => requestUrl(input).includes("/search")),
    ).toHaveLength(1);
  });
  it("shows request failure and retries with current filters rather than claiming zero matches", async () => {
    params = new URLSearchParams(`q=Audio&brand=${brandId}`);
    vi.mocked(fetch).mockImplementation((input) =>
      Promise.resolve(
        json(
          requestUrl(input).includes("/categories") ? [category] : {},
          requestUrl(input).includes("/categories") ? 200 : 503,
        ),
      ),
    );
    render(<DiscoveryPage />);
    await screen.findByRole("button", { name: "Retry products" });
    expect(
      screen.queryByText("No matching products found"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter Brand: Selected" }),
    ).toBeInTheDocument();
    respond();
    fireEvent.click(screen.getByRole("button", { name: "Retry products" }));
    await screen.findByRole("heading", { name: product.title });
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) =>
          requestUrl(input).includes(`brand=${brandId}`),
        ),
    ).toHaveLength(2);
  });
  it("treats malformed responses as failure, not empty success", async () => {
    const result = structuredClone(page());
    result.results[0]!.currency = "bad";
    respond(result);
    render(<DiscoveryPage />);
    await screen.findByRole("button", { name: "Retry products" });
    expect(
      screen.queryByText("No matching products found"),
    ).not.toBeInTheDocument();
  });
  it("blocks invalid addresses before product requests and offers explicit reset", async () => {
    params = new URLSearchParams("min_price=1e3");
    respond();
    render(<DiscoveryPage />);
    expect(
      screen.getByRole("heading", { name: "Check your search address" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(requestUrl(vi.mocked(fetch).mock.calls[0]![0])).toContain(
      "/categories",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reset search address" }),
    );
    expect(push).toHaveBeenCalledWith("/search");
  });
  it("provides category suggestions and preserves category identity when clearing empty results", async () => {
    params = new URLSearchParams(`q=Nothing&brand=${brandId}&page=4`);
    const result = page();
    result.results = [];
    respond(result);
    render(<DiscoveryPage categoryId={categoryId} />);
    await screen.findByRole("heading", { name: "This page has no products." });
    expect(
      screen.getByRole("link", { name: "Go to first page" }),
    ).toHaveAttribute(
      "href",
      `/categories/${categoryId}?q=Nothing&brand=${brandId}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear All Filters" }));
    expect(push).toHaveBeenCalledWith(`/categories/${categoryId}?q=Nothing`, {
      scroll: false,
    });
    fireEvent.change(screen.getByLabelText("Try another search"), {
      target: { value: "Better" },
    });
    fireEvent.submit(
      screen.getByLabelText("Try another search").closest("form")!,
    );
    expect(push).toHaveBeenCalledWith(`/categories/${categoryId}?q=Better`);
  });
  it("offers real category suggestions for empty search and reports unknown categories", async () => {
    const result = page();
    result.count = 0;
    result.results = [];
    respond(result);
    const view = render(<DiscoveryPage />);
    await screen.findByText("No matching products found");
    expect(screen.getByRole("link", { name: "Audio" })).toHaveAttribute(
      "href",
      `/categories/${categoryId}`,
    );
    view.rerender(<DiscoveryPage categoryId={brandId} />);
    await screen.findByText("This category is unavailable.");
    expect(
      screen.queryByRole("heading", { name: product.title }),
    ).not.toBeInTheDocument();
  });
  it("immediately clears old evidence during URL changes and ignores late aborted success", async () => {
    respond();
    const view = render(
      <StrictMode>
        <DiscoveryPage />
      </StrictMode>,
    );
    await screen.findByRole("heading", { name: product.title });
    let complete!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    params = new URLSearchParams("q=Slow");
    view.rerender(
      <StrictMode>
        <DiscoveryPage />
      </StrictMode>,
    );
    expect(
      screen.queryByRole("heading", { name: product.title }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("21 items found")).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading products" }),
    ).toBeInTheDocument();
    const request = vi.mocked(fetch).mock.calls.at(-1)![1];
    expect(request?.signal?.aborted).toBe(false);
    const newer = page();
    newer.results = [{ ...product, title: "New search product" }];
    respond(newer);
    params = new URLSearchParams("q=New");
    view.rerender(
      <StrictMode>
        <DiscoveryPage />
      </StrictMode>,
    );
    await screen.findByRole("heading", { name: "New search product" });
    expect(request?.signal?.aborted).toBe(true);
    await act(async () => complete(json(page())));
    expect(
      screen.queryByRole("heading", { name: product.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "New search product" }),
    ).toBeInTheDocument();
  });
  it("ignores late aborted failures and aborts reads on unmount", async () => {
    let reject!: (reason: unknown) => void;
    vi.mocked(fetch).mockImplementation((input) =>
      requestUrl(input).includes("/categories")
        ? Promise.resolve(json([category]))
        : new Promise((_, failure) => {
            reject = failure;
          }),
    );
    const view = render(<DiscoveryPage />);
    const oldRequest = vi
      .mocked(fetch)
      .mock.calls.find(([input]) => requestUrl(input).includes("/search"))![1];
    respond();
    params = new URLSearchParams("q=New");
    view.rerender(<DiscoveryPage />);
    await screen.findByRole("heading", { name: product.title });
    await act(async () => reject(new Error("late failure")));
    expect(
      screen.queryByRole("button", { name: "Retry products" }),
    ).not.toBeInTheDocument();
    expect(oldRequest?.signal?.aborted).toBe(true);
    const lastRequest = vi.mocked(fetch).mock.calls.at(-1)![1];
    view.unmount();
    expect(lastRequest?.signal?.aborted).toBe(true);
  });
  it("keeps drawer changes local on cancel and applies filters once with page reset", async () => {
    params = new URLSearchParams("q=Audio&page=2");
    respond();
    render(<DiscoveryPage />);
    await screen.findByRole("heading", { name: product.title });
    const trigger = screen.getByRole("button", { name: "Filters" });
    trigger.focus();
    fireEvent.click(trigger);
    let drawer = screen.getByRole("dialog", { name: "Filters" });
    fireEvent.click(within(drawer).getByRole("checkbox"));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    drawer = screen.getByRole("dialog", { name: "Filters" });
    expect(within(drawer).getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(within(drawer).getByRole("checkbox"));
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Apply filters" }),
    );
    expect(push).toHaveBeenCalledExactlyOnceWith(
      "/search?q=Audio&in_stock=true",
      { scroll: false },
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("validates price edits exactly and resyncs fields when the URL changes", () => {
    const change = vi.fn();
    const view = render(
      <SearchFiltersSidebar
        facets={page().facets}
        filters={{ min_price: "10", max_price: "20" }}
        onFilterChange={change}
      />,
    );
    fireEvent.change(screen.getByLabelText("Minimum price"), {
      target: { value: "9007199254740993.10" },
    });
    fireEvent.change(screen.getByLabelText("Maximum price"), {
      target: { value: "9007199254740993.09" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply price" }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Minimum price")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    fireEvent.change(screen.getByLabelText("Maximum price"), {
      target: { value: "9007199254740993.11" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply price" }));
    expect(change).toHaveBeenCalledWith({
      min_price: "9007199254740993.10",
      max_price: "9007199254740993.11",
    });
    view.rerender(
      <SearchFiltersSidebar
        facets={page().facets}
        filters={{ min_price: "0", max_price: "50" }}
        onFilterChange={change}
      />,
    );
    expect(screen.getByLabelText("Minimum price")).toHaveValue("0");
    expect(screen.getByLabelText("Maximum price")).toHaveValue("50");
    expect(screen.getByLabelText("Minimum price")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
