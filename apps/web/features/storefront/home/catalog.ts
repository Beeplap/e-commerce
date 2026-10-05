import type {
  StorefrontCategory,
  StorefrontProductCard,
} from "@/lib/api/types";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim());
const identifier = (value: unknown): value is string =>
  typeof value === "string" && uuid.test(value);
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const rating = (value: unknown) =>
  value === null ||
  (typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 5);
const money = (value: unknown) =>
  typeof value === "string" &&
  value.length <= 128 &&
  /^\d+(?:\.\d+)?$/.test(value);

/** Validate homepage evidence locally; the existing API contract/client are unchanged. */
export function homeCategories(value: unknown): StorefrontCategory[] {
  if (!Array.isArray(value)) throw new Error("Invalid category evidence");
  const ids = new Set<string>();
  return value.slice(0, 24).map((category: unknown) => {
    if (
      !record(category) ||
      !identifier(category.id) ||
      ids.has(category.id) ||
      !text(category.name) ||
      typeof category.slug !== "string" ||
      typeof category.description !== "string" ||
      !(category.parent_id === null || identifier(category.parent_id)) ||
      !count(category.product_count)
    )
      throw new Error("Invalid category evidence");
    ids.add(category.id);
    return category as unknown as StorefrontCategory;
  });
}

export type HomeCatalog = { count: number; products: StorefrontProductCard[] };
export function homeProducts(value: unknown): HomeCatalog {
  if (
    !record(value) ||
    !count(value.count) ||
    !Array.isArray(value.results) ||
    value.results.length > 25 ||
    value.count < value.results.length ||
    (value.count > 0 && value.results.length === 0)
  )
    throw new Error("Invalid catalog evidence");
  const ids = new Set<string>();
  const products = value.results.map((product: unknown) => {
    if (
      !record(product) ||
      !identifier(product.id) ||
      ids.has(product.id) ||
      !text(product.title) ||
      typeof product.slug !== "string" ||
      typeof product.short_description !== "string" ||
      !identifier(product.category_id) ||
      !text(product.category_name) ||
      !(product.brand_id === null || identifier(product.brand_id)) ||
      !(product.brand_name === null || text(product.brand_name)) ||
      !money(product.starting_price) ||
      !(product.compare_at_price === null || money(product.compare_at_price)) ||
      typeof product.currency !== "string" ||
      !/^[A-Z]{3}$/.test(product.currency) ||
      typeof product.in_stock !== "boolean" ||
      !rating(product.average_rating) ||
      !count(product.review_count) ||
      !record(product.seller) ||
      !identifier(product.seller.id) ||
      !text(product.seller.name) ||
      !text(product.seller.store_name) ||
      !rating(product.seller.rating) ||
      !(
        product.thumbnail_url === null ||
        (typeof product.thumbnail_url === "string" &&
          new RegExp(
            `^/api/v1/storefront/products/${product.id}/images/${uuid.source.slice(1, -1)}/$`,
            "i",
          ).test(product.thumbnail_url))
      )
    )
      throw new Error("Invalid product evidence");
    ids.add(product.id);
    return product as unknown as StorefrontProductCard;
  });
  return { count: value.count, products };
}

export function homeSellers(products: StorefrontProductCard[]) {
  const stores = new Map<
    string,
    { seller: StorefrontProductCard["seller"]; categories: Set<string> }
  >();
  for (const product of products) {
    const store = stores.get(product.seller.id) ?? {
      seller: product.seller,
      categories: new Set<string>(),
    };
    store.categories.add(product.category_name);
    stores.set(product.seller.id, store);
  }
  return [...stores.values()].slice(0, 4);
}
