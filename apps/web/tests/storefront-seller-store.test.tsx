import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Page,
  StorefrontProductCard,
  StorefrontSellerDetail,
} from "@/lib/api/types";
import { SellerStoreView } from "@/features/storefront/seller-store-view";
import { storefrontApi } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  storefrontApi: { products: vi.fn() },
}));

const seller: StorefrontSellerDetail = {
  id: "30000000-0000-4000-8000-000000000001",
  name: "Studio North",
  store_name: "Studio North",
  description: "Small batch ceramics for everyday rituals.",
  contact_email: "hello@studionorth.example",
  city: "Portland",
  state: "OR",
  country: "US",
  average_rating: 4.8,
  total_products: 1,
};

const product: StorefrontProductCard = {
  id: "80000000-0000-4000-8000-000000000001",
  title: "Hand thrown ceramic cup",
  slug: "hand-thrown-ceramic-cup",
  short_description: "A small batch stoneware cup.",
  category_id: "60000000-0000-4000-8000-000000000001",
  category_name: "Ceramics",
  brand_id: null,
  brand_name: null,
  starting_price: "24.00",
  compare_at_price: "30.00",
  currency: "USD",
  thumbnail_url: null,
  in_stock: true,
  average_rating: 4.8,
  review_count: 12,
  seller: {
    id: seller.id,
    name: seller.name,
    store_name: seller.store_name,
    rating: seller.average_rating,
  },
};

describe("seller storefront", () => {
  beforeEach(() => {
    vi.mocked(storefrontApi.products).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [product],
    } satisfies Page<StorefrontProductCard>);
  });

  it("keeps the shop identity and real merchandise ahead of badges and card chrome", async () => {
    render(<SellerStoreView seller={seller} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Studio North" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified seller")).toBeInTheDocument();
    expect(screen.getByText("Portland, OR, US")).toBeInTheDocument();
    expect(screen.getByText("1 active product")).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "View Hand thrown ceramic cup" }),
    ).toBeInTheDocument();
    expect(screen.getByText("24.00 USD")).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.queryByText("20% OFF")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View" }),
    ).not.toBeInTheDocument();
  });

  it("shows a product-read error and retries without fabricating an empty shop", async () => {
    vi.mocked(storefrontApi.products).mockRejectedValueOnce(
      new Error("Unavailable"),
    );
    render(<SellerStoreView seller={seller} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t load this shop’s products.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("link", { name: "View Hand thrown ceramic cup" }),
    ).toBeInTheDocument();
    expect(storefrontApi.products).toHaveBeenCalledTimes(2);
  });
});
