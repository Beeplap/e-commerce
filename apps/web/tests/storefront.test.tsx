import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { StorefrontHeader } from "@/features/storefront/header";
import { StorefrontFooter } from "@/features/storefront/footer";
import { ProductCard } from "@/features/storefront/product-card";
import { ProductDetailView } from "@/features/storefront/product-detail-view";
import { SellerStoreView } from "@/features/storefront/seller-store-view";
import type {
  StorefrontCategory,
  StorefrontProductCard,
  StorefrontProductDetail,
  StorefrontSellerDetail,
} from "@/lib/api/types";
import { json } from "./fixtures";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}));

const mockCategory: StorefrontCategory = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Electronics",
  slug: "electronics",
  description: "Gadgets and tech devices",
  parent_id: null,
  product_count: 14,
};

const mockProductCard: StorefrontProductCard = {
  id: "80000000-0000-4000-8000-000000000001",
  title: "Super Phone X",
  slug: "super-phone-x",
  short_description: "Flagship 5G smartphone",
  category_id: mockCategory.id,
  category_name: mockCategory.name,
  brand_id: "70000000-0000-4000-8000-000000000001",
  brand_name: "Apex",
  starting_price: "799.00",
  compare_at_price: "999.00",
  currency: "USD",
  thumbnail_url:
    "/api/v1/storefront/products/80000000-0000-4000-8000-000000000001/images/1",
  in_stock: true,
  average_rating: 4.8,
  review_count: 42,
  seller: {
    id: "30000000-0000-4000-8000-000000000001",
    name: "Apex Store",
    store_name: "Apex Official",
    rating: 4.9,
  },
};

const mockProductDetail: StorefrontProductDetail = {
  ...mockProductCard,
  description:
    "The ultimate flagship phone with ultra-fast display and triple camera system.",
  category: mockCategory,
  brand: {
    id: "70000000-0000-4000-8000-000000000001",
    name: "Apex",
    slug: "apex",
    product_count: 8,
  },
  total_available_stock: 15,
  rating_breakdown: { "5": 35, "4": 5, "3": 2, "2": 0, "1": 0 },
  images: [
    {
      id: "90000000-0000-4000-8000-000000000001",
      url: "/images/phone-front.png",
      alt_text: "Front View",
      sort_order: 0,
    },
    {
      id: "90000000-0000-4000-8000-000000000002",
      url: "/images/phone-back.png",
      alt_text: "Back View",
      sort_order: 1,
    },
  ],
  variants: [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      sku: "SPX-128-BLK",
      price: "799.00",
      compare_at_price: "999.00",
      in_stock: true,
      available_quantity: 10,
      attributes: { Color: "Space Black", Storage: "128GB" },
    },
    {
      id: "a0000000-0000-4000-8000-000000000002",
      sku: "SPX-256-SLV",
      price: "899.00",
      compare_at_price: "1099.00",
      in_stock: true,
      available_quantity: 5,
      attributes: { Color: "Silver", Storage: "256GB" },
    },
  ],
  recent_reviews: [
    {
      id: "b0000000-0000-4000-8000-000000000001",
      customer_name: "Marcus A.",
      rating: 5,
      title: "Incredible speed",
      body: "Battery easily lasts 2 days and the camera is unmatched.",
      verified_purchase: true,
      created_at: "2026-09-15T12:00:00Z",
      seller_response: "Thank you Marcus! We appreciate your support.",
      seller_response_at: "2026-09-16T09:00:00Z",
    },
    {
      id: "b0000000-0000-4000-8000-000000000002",
      customer_name: "Verified Customer",
      rating: 4,
      title: "Great value",
      body: "Very solid device, smooth software.",
      verified_purchase: false,
      created_at: "2026-09-18T10:00:00Z",
      seller_response: null,
      seller_response_at: null,
    },
  ],
};

const mockSellerDetail: StorefrontSellerDetail = {
  id: "30000000-0000-4000-8000-000000000001",
  name: "Apex Store",
  store_name: "Apex Official",
  description: "Official seller of Apex consumer electronics and accessories.",
  contact_email: "support@apex.example.com",
  city: "San Francisco",
  state: "CA",
  country: "US",
  average_rating: 4.9,
  total_products: 18,
};

describe("Customer Storefront UI Components", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders StorefrontHeader with branding, search, cart, and categories", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json([mockCategory]));

    render(
      <AuthProvider>
        <StorefrontHeader />
      </AuthProvider>,
    );

    expect(
      screen.getByRole("link", { name: /QuickCommerce/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Shopping Cart")).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });

    // Test search submit
    const searchInput = screen.getByPlaceholderText(/search products/i);
    fireEvent.change(searchInput, { target: { value: "Apex" } });
    fireEvent.submit(searchInput.closest("form")!);

    expect(mockPush).toHaveBeenCalledWith("/search?q=Apex");
  });

  it("renders StorefrontFooter with trust badges and seller links", () => {
    render(<StorefrontFooter />);

    expect(screen.getByText(/100% Verified Sellers/i)).toBeInTheDocument();
    expect(screen.getByText(/Become a Seller/i)).toBeInTheDocument();
    expect(screen.getByText(/Customer Trust/i)).toBeInTheDocument();
  });

  it("renders ProductCard with title, discount, rating, and seller name", () => {
    render(<ProductCard product={mockProductCard} />);

    expect(screen.getByText("Super Phone X")).toBeInTheDocument();
    expect(screen.getByText("$799.00")).toBeInTheDocument();
    expect(screen.getByText("$999.00")).toBeInTheDocument();
    expect(screen.getByText("20% OFF")).toBeInTheDocument();
    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.getByText("Apex Official")).toBeInTheDocument();
    expect(screen.getByText("(42)")).toBeInTheDocument();
  });

  it("renders ProductDetailView and interacts with variant selector and cart", () => {
    render(<ProductDetailView product={mockProductDetail} />);

    expect(
      screen.getByRole("heading", { name: "Super Phone X" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Apex Official")).toBeInTheDocument();
    expect(screen.getByText("Verified Seller")).toBeInTheDocument();
    expect(screen.getAllByText("$799.00")[0]).toBeInTheDocument();
    expect(screen.getByText("Save 20%")).toBeInTheDocument();

    // In-stock availability
    expect(
      screen.getByText(/In Stock \(10 units ready to ship\)/i),
    ).toBeInTheDocument();

    // Select second variant (Silver / 256GB at $899.00)
    const secondVariantBtn = screen
      .getByText(/Silver \/ 256GB/i)
      .closest("button")!;
    fireEvent.click(secondVariantBtn);

    expect(screen.getAllByText("$899.00")[0]).toBeInTheDocument();
    expect(
      screen.getByText(/In Stock \(5 units ready to ship\)/i),
    ).toBeInTheDocument();

    // Quantity selector
    const plusBtn = screen.getByLabelText("Increase quantity");
    fireEvent.click(plusBtn);
    expect(screen.getByTestId("selected-quantity")).toHaveTextContent("2");

    // Add to Cart action
    const addToCartBtn = screen.getByRole("button", { name: "Add to Cart" });
    fireEvent.click(addToCartBtn);

    expect(
      screen.getByText(/Added to cart! Real-time cart reservations active/i),
    ).toBeInTheDocument();

    // Reviews section
    expect(screen.getByText("Marcus A.")).toBeInTheDocument();
    expect(screen.getByText("Verified Purchase")).toBeInTheDocument();
    expect(screen.getByText("Incredible speed")).toBeInTheDocument();
    expect(screen.getByText("Seller Response:")).toBeInTheDocument();
    expect(screen.getByText(/Thank you Marcus!/i)).toBeInTheDocument();
    expect(screen.getByText("Verified Customer")).toBeInTheDocument();
  });

  it("renders SellerStoreView with profile banner and catalog products", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({
        count: 1,
        next: null,
        previous: null,
        results: [mockProductCard],
      }),
    );

    render(<SellerStoreView seller={mockSellerDetail} />);

    expect(screen.getByText("Apex Official")).toBeInTheDocument();
    expect(
      screen.getByText(/Official seller of Apex consumer electronics/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/San Francisco, CA, US/i)).toBeInTheDocument();
    expect(screen.getByText(/18 Active Products/i)).toBeInTheDocument();
    expect(screen.getByText("4.9")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Super Phone X")).toBeInTheDocument();
    });
  });
});
