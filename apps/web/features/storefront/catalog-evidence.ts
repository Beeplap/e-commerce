import type {
  StorefrontCategory,
  StorefrontProductCard,
} from "@/lib/api/types";

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const isText = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim());
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && uuidPattern.test(value);
export const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export const isRating = (value: unknown) =>
  value === null ||
  (typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 5);
export const isDecimal = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 128 &&
  /^\d+(?:\.\d+)?$/.test(value);

/** Validate only the bounded records that callers consume; no authority is inferred. */
export function categoryEvidence(
  value: unknown,
  limit = 24,
): StorefrontCategory[] {
  if (!Array.isArray(value)) throw new Error("Invalid category evidence");
  const ids = new Set<string>();
  return value.slice(0, limit).map((category: unknown) => {
    if (
      !isRecord(category) ||
      !isUuid(category.id) ||
      ids.has(category.id) ||
      !isText(category.name) ||
      typeof category.slug !== "string" ||
      typeof category.description !== "string" ||
      !(category.parent_id === null || isUuid(category.parent_id)) ||
      !isCount(category.product_count)
    )
      throw new Error("Invalid category evidence");
    ids.add(category.id);
    return category as unknown as StorefrontCategory;
  });
}

export function productEvidence(
  value: unknown,
  limit: number,
): StorefrontProductCard[] {
  if (!Array.isArray(value) || value.length > limit)
    throw new Error("Invalid product evidence");
  const ids = new Set<string>();
  return value.map((product: unknown) => {
    if (
      !isRecord(product) ||
      !isUuid(product.id) ||
      ids.has(product.id) ||
      !isText(product.title) ||
      typeof product.slug !== "string" ||
      typeof product.short_description !== "string" ||
      !isUuid(product.category_id) ||
      !isText(product.category_name) ||
      !(product.brand_id === null || isUuid(product.brand_id)) ||
      !(product.brand_name === null || isText(product.brand_name)) ||
      !isDecimal(product.starting_price) ||
      !(
        product.compare_at_price === null || isDecimal(product.compare_at_price)
      ) ||
      typeof product.currency !== "string" ||
      !/^[A-Z]{3}$/.test(product.currency) ||
      typeof product.in_stock !== "boolean" ||
      !isRating(product.average_rating) ||
      !isCount(product.review_count) ||
      !isRecord(product.seller) ||
      !isUuid(product.seller.id) ||
      !isText(product.seller.name) ||
      !isText(product.seller.store_name) ||
      !isRating(product.seller.rating) ||
      !(
        product.thumbnail_url === null ||
        (typeof product.thumbnail_url === "string" &&
          new RegExp(
            `^/api/v1/storefront/products/${product.id}/images/${uuidPattern.source.slice(1, -1)}/$`,
            "i",
          ).test(product.thumbnail_url))
      )
    )
      throw new Error("Invalid product evidence");
    ids.add(product.id);
    return product as unknown as StorefrontProductCard;
  });
}
