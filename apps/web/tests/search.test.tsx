import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SearchBar } from "@/features/storefront/search-bar";
import {
  ActiveFilterBadges,
  type FilterState,
  SearchFiltersSidebar,
} from "@/features/storefront/search-filters";
import SearchPage from "@/app/search/page";
import { AuthProvider } from "@/features/auth/auth-provider";
import type {
  StorefrontProductCard,
  StorefrontSearchFacets,
  StorefrontSearchResultPage,
  StorefrontSuggestResponse,
} from "@/lib/api/types";
import { json } from "./fixtures";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams("q=Apex");

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const mockProductCard: StorefrontProductCard = {
  id: "80000000-0000-4000-8000-000000000001",
  title: "Apex Wireless Headphones",
  slug: "apex-wireless-headphones",
  short_description: "Premium wireless headphones",
  category_id: "60000000-0000-4000-8000-000000000001",
  category_name: "Audio & Headphones",
  brand_id: "70000000-0000-4000-8000-000000000001",
  brand_name: "Apex",
  starting_price: "149.00",
  compare_at_price: "199.00",
  currency: "USD",
  thumbnail_url: null,
  in_stock: true,
  average_rating: 4.8,
  review_count: 24,
  seller: {
    id: "30000000-0000-4000-8000-000000000001",
    name: "Apex Store",
    store_name: "Apex Official",
    rating: 4.9,
  },
};

const mockFacets: StorefrontSearchFacets = {
  categories: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      name: "Audio & Headphones",
      slug: "audio",
      count: 5,
    },
  ],
  brands: [
    {
      id: "70000000-0000-4000-8000-000000000001",
      name: "Apex",
      slug: "apex",
      count: 8,
    },
  ],
  price_brackets: [
    { label: "Under $50", min_price: "0", max_price: "50", count: 2 },
    { label: "$100 to $250", min_price: "100", max_price: "250", count: 6 },
  ],
  rating_brackets: [{ min_rating: 4, label: "4 stars & above", count: 7 }],
  in_stock_count: 10,
};

const mockSearchResults: StorefrontSearchResultPage = {
  count: 1,
  next: null,
  previous: null,
  facets: mockFacets,
  results: [mockProductCard],
};

const mockSuggestResponse: StorefrontSuggestResponse = {
  query: "Apex",
  suggestions: ["Apex Wireless", "Apex Headphones"],
  categories: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      name: "Audio & Headphones",
      slug: "audio",
      description: "",
      parent_id: null,
      product_count: 5,
    },
  ],
  brands: [
    {
      id: "70000000-0000-4000-8000-000000000001",
      name: "Apex",
      slug: "apex",
      product_count: 8,
    },
  ],
  products: [
    {
      id: mockProductCard.id,
      title: mockProductCard.title,
      slug: mockProductCard.slug,
      starting_price: mockProductCard.starting_price,
      currency: "USD",
      thumbnail_url: null,
      category_name: mockProductCard.category_name,
    },
  ],
};

describe("Search & Faceted Filtering UI", () => {
  beforeAll(() => {
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

  afterEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("q=Apex");
  });

  it("triggers autocomplete suggestions when user types in SearchBar", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : "url" in input
            ? input.url
            : input.toString();
      if (url.includes("/suggest"))
        return Promise.resolve(json(mockSuggestResponse));
      return Promise.resolve(json([]));
    });

    render(<SearchBar initialQuery="" />);

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Apex" } });

    await waitFor(() => {
      expect(screen.getByText("Apex Wireless")).toBeInTheDocument();
      expect(screen.getAllByText("Audio & Headphones")[0]).toBeInTheDocument();
      expect(screen.getByText("Apex Wireless Headphones")).toBeInTheDocument();
    });

    // Keyboard navigation: ArrowDown then Enter
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/search?q=Apex%20Wireless");
  });

  it("renders SearchFiltersSidebar and triggers filter callbacks", () => {
    const handleFilterChange = vi.fn();
    const currentFilters: FilterState = {
      category: undefined,
      brand: undefined,
    };

    render(
      <SearchFiltersSidebar
        facets={mockFacets}
        filters={currentFilters}
        onFilterChange={handleFilterChange}
      />,
    );

    expect(screen.getByText("In-Stock Only")).toBeInTheDocument();
    expect(screen.getByText("Audio & Headphones")).toBeInTheDocument();
    expect(screen.getByText("Apex")).toBeInTheDocument();
    // The backend price bounds apply to listed units, not a promised USD conversion.
    expect(screen.getByText("100 to 250")).toBeInTheDocument();

    // Select category
    fireEvent.click(screen.getByText("Audio & Headphones"));
    expect(handleFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "60000000-0000-4000-8000-000000000001",
      }),
    );

    // Select price bracket
    fireEvent.click(screen.getByText("100 to 250"));
    expect(handleFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ min_price: "100", max_price: "250" }),
    );

    // Toggle in-stock
    fireEvent.click(screen.getByRole("checkbox"));
    expect(handleFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ in_stock: true }),
    );
  });

  it("renders ActiveFilterBadges and clears individual filters", () => {
    const handleFilterChange = vi.fn();
    const handleClearAll = vi.fn();
    const activeFilters: FilterState = {
      category: "60000000-0000-4000-8000-000000000001",
      min_price: "100",
      max_price: "250",
      in_stock: true,
    };

    render(
      <ActiveFilterBadges
        filters={activeFilters}
        facets={mockFacets}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAll}
      />,
    );

    expect(
      screen.getByText("Category: Audio & Headphones"),
    ).toBeInTheDocument();
    expect(screen.getByText("Price: 100 to 250")).toBeInTheDocument();
    expect(screen.getByText("In Stock Only")).toBeInTheDocument();

    // Remove Category filter
    const removeCatBtn = screen.getByLabelText(
      "Remove filter Category: Audio & Headphones",
    );
    fireEvent.click(removeCatBtn);
    expect(handleFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ category: undefined }),
    );

    // Click Clear All
    const clearAllBtn = screen.getByText("Clear All");
    fireEvent.click(clearAllBtn);
    expect(handleClearAll).toHaveBeenCalled();
  });

  it("renders SearchPage with products, active query, and sort selector", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : "url" in input
            ? input.url
            : input.toString();
      if (url.includes("/categories")) return Promise.resolve(json([]));
      if (url.includes("/search"))
        return Promise.resolve(json(mockSearchResults));
      return Promise.resolve(json({}));
    });

    render(
      <AuthProvider>
        <SearchPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Apex Wireless Headphones")).toBeInTheDocument();
      expect(screen.getByText("149.00 USD")).toBeInTheDocument();
      expect(screen.getByText("1 item found")).toBeInTheDocument();
    });

    // Test sort selector change
    const sortSelect = screen.getByLabelText("Sort:");
    fireEvent.change(sortSelect, { target: { value: "price_asc" } });

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("sort=price_asc"),
      { scroll: false },
    );
  });

  it("renders empty state with suggestion button when 0 products match", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : "url" in input
            ? input.url
            : input.toString();
      if (url.includes("/categories")) return Promise.resolve(json([]));
      if (url.includes("/search")) {
        return Promise.resolve(
          json({
            count: 0,
            next: null,
            previous: null,
            facets: mockFacets,
            results: [],
          }),
        );
      }
      return Promise.resolve(json({}));
    });

    render(
      <AuthProvider>
        <SearchPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No matching products found"),
      ).toBeInTheDocument();
      expect(screen.getByText("Clear All Filters")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Clear All Filters"));
    expect(mockPush).toHaveBeenCalledWith("/search?q=Apex", { scroll: false });
  });
});
