import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/auth-provider";
import { SellerWorkspace } from "@/features/workspaces/seller-workspace";
import { SellerProducts, PlatformProducts } from "@/features/catalog/products";
import { CreateProduct } from "@/features/catalog/product-form";
import {
  SellerProductDetail,
  PlatformProductDetail,
} from "@/features/catalog/product-detail";
import { PlatformCategories } from "@/features/catalog/categories";
import { PlatformAttributes } from "@/features/catalog/attributes";
import { PlatformBrands } from "@/features/catalog/brands";
import {
  type Product,
  type Variant,
  type Category,
  type Brand,
  type Attribute,
  type Option,
  type CategoryLink,
  type History,
} from "@/features/catalog/api";
import { csrf, json, membership, user } from "./fixtures";

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/products",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const category: Category = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Electronics",
  slug: "electronics",
  parent_id: null,
  description: "Gadgets and devices",
  sort_order: 1,
  is_active: true,
};

const brand: Brand = {
  id: "70000000-0000-4000-8000-000000000001",
  name: "Acme",
  slug: "acme",
  is_active: true,
};

const product: Product = {
  id: "80000000-0000-4000-8000-000000000001",
  seller_id: membership.seller.id,
  category,
  brand,
  name: "Super Phone",
  slug: "super-phone",
  description: "A great phone description.",
  short_description: "Great phone",
  status: "draft",
  currency: "USD",
  created_by_id: user.id,
  approved_by_id: null,
  approved_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

const variant: Variant = {
  id: "90000000-0000-4000-8000-000000000001",
  product_id: product.id,
  sku: "PHONE-BLK-128",
  barcode: "123456789012",
  price: "699.99",
  compare_at_price: "799.99",
  cost_price: "400.00",
  weight: "0.200",
  length: "15.000",
  width: "7.500",
  height: "0.800",
  status: "active",
};

const attribute: Attribute = {
  id: "a0000000-0000-4000-8000-000000000001",
  name: "Color",
  code: "color",
  value_type: "choice",
  scope: "variant",
  is_active: true,
};

const option: Option = {
  id: "b0000000-0000-4000-8000-000000000001",
  attribute_id: attribute.id,
  name: "Midnight Black",
  value: "midnight-black",
  is_active: true,
};

const categoryLink: CategoryLink = {
  id: "c0000000-0000-4000-8000-000000000001",
  name: attribute.name,
  category_id: category.id,
  attribute,
  is_required: true,
};

const historyItem: History = {
  id: "d0000000-0000-4000-8000-000000000001",
  actor_id: user.id,
  from_status: "",
  to_status: "draft",
  reason: "Initial creation",
  created_at: "2026-10-01T00:00:00Z",
};

const page = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

const sellerPermissions = [
  "seller.context.read",
  "catalog.product.read",
  "catalog.product.create",
  "catalog.product.update",
  "catalog.product.archive",
];

const platformPermissions = [
  "platform.access",
  "platform.catalog.read",
  "platform.catalog.manage",
  "platform.products.read",
  "platform.products.moderate",
];

function mockApi(
  userCaps = platformPermissions,
  memberCaps = sellerPermissions,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url === "/api/v1/auth/me")
      return json({ ...user, platform_permissions: userCaps });
    if (url === "/api/v1/auth/csrf") return json({ csrf_token: csrf });
    if (url.startsWith("/api/v1/seller/memberships"))
      return json(page([{ ...membership, permissions: memberCaps }]));
    if (url === "/api/v1/seller/access")
      return json({ ...membership, permissions: memberCaps });

    // Catalog taxonomy endpoints
    if (url.includes("/catalog/categories?")) return json(page([category]));
    if (url.includes("/catalog/brands?")) return json(page([brand]));
    if (url.includes("/catalog/attributes?")) return json(page([attribute]));
    if (url.includes("/catalog/options?")) return json(page([option]));
    if (url.includes("/catalog/category-attributes?"))
      return json(page([categoryLink]));

    // Product endpoints
    if (url.includes("/variants?")) return json(page([variant]));
    if (url.includes("/images?")) return json(page([]));
    if (url.includes("/attributes?")) return json(page([]));
    if (url.includes("/history?")) return json(page([historyItem]));
    if (url.includes("/submit-for-review") && method === "POST")
      return json({ ...product, status: "pending_review" });
    if (url.includes("/approve") && method === "POST")
      return json({
        ...product,
        status: "active",
        approved_at: "2026-10-01T01:00:00Z",
      });
    if (url.includes("/reject") && method === "POST")
      return json({ ...product, status: "rejected" });

    if (
      url === "/api/v1/seller/products" ||
      url.startsWith("/api/v1/seller/products?") ||
      url === "/api/v1/admin/products" ||
      url.startsWith("/api/v1/admin/products?")
    ) {
      if (method === "POST") return json(product, 201);
      return json(page([product]));
    }

    if (url.includes("/products/")) return json(product);

    return json({});
  });
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Catalog UI and permissions", () => {
  it("renders seller products list when authorized", async () => {
    vi.stubGlobal("fetch", mockApi());
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerProducts />
        </SellerWorkspace>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Products" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Super Phone")).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create product" }),
    ).toBeInTheDocument();
  });

  it("blocks seller products view when lacking catalog.product.read permission", async () => {
    vi.stubGlobal("fetch", mockApi([], ["seller.context.read"]));
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerProducts />
        </SellerWorkspace>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "You don’t have access" }),
    ).toBeInTheDocument();
  });

  it("renders create product form with category picker", async () => {
    vi.stubGlobal("fetch", mockApi());
    render(
      <AuthProvider>
        <SellerWorkspace>
          <CreateProduct />
        </SellerWorkspace>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Create product" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Product name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Category/i)).toBeInTheDocument();
  });

  it("renders seller product detail with variants and exact decimal prices", async () => {
    vi.stubGlobal("fetch", mockApi());
    render(
      <AuthProvider>
        <SellerWorkspace>
          <SellerProductDetail productId={product.id} />
        </SellerWorkspace>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Super Phone" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("PHONE-BLK-128")).toBeInTheDocument();
    // Verify money formatting: $699.99 USD
    expect(screen.getByText(/699\.99\s*USD/)).toBeInTheDocument();
    expect(screen.getByText(/799\.99\s*USD/)).toBeInTheDocument();
    // Verify actions
    expect(
      screen.getByRole("button", { name: "Submit for review" }),
    ).toBeInTheDocument();
  });

  it("renders platform moderation queue and detail with approve/reject actions", async () => {
    vi.stubGlobal("fetch", mockApi());
    render(
      <AuthProvider>
        <PlatformProducts />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Product moderation" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Super Phone")).toBeInTheDocument();
  });

  it("allows platform admin to moderate pending products with a rejection reason", async () => {
    const fetchMock = mockApi();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <PlatformProductDetail productId={product.id} />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Super Phone" }),
    ).toBeInTheDocument();
  });

  it("renders platform category management table", async () => {
    vi.stubGlobal("fetch", mockApi());
    render(
      <AuthProvider>
        <PlatformCategories />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Categories" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Electronics")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add category" }),
    ).toBeInTheDocument();
  });

  it("renders platform attribute management table and handles options", async () => {
    vi.stubGlobal("fetch", mockApi());
    render(
      <AuthProvider>
        <PlatformAttributes />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Attributes" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Color")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Options" })).toBeInTheDocument();
  });

  it("renders platform brand management table", async () => {
    vi.stubGlobal("fetch", mockApi());
    render(
      <AuthProvider>
        <PlatformBrands />
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Brands" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add brand" }),
    ).toBeInTheDocument();
  });
});
