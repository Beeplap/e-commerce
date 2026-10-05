import type { StorefrontProductDetail } from "@/lib/api/types";
import {
  categoryEvidence,
  isCount,
  isDecimal,
  isRating,
  isRecord,
  isText,
  isUuid,
} from "../catalog-evidence";

const optionalPrice = (value: unknown) => value === null || isDecimal(value);
const timestamp = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
    value,
  ) &&
  Number.isFinite(Date.parse(value));
const boundedRows = (
  value: unknown,
  maximum: number,
): Record<string, unknown>[] => {
  if (!Array.isArray(value) || value.length > maximum)
    throw new Error("Invalid product detail");
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    if (!isRecord(item) || !isUuid(item.id) || ids.has(item.id.toLowerCase()))
      throw new Error("Invalid product detail");
    ids.add(item.id.toLowerCase());
    return item;
  });
};

/** Presentation evidence only: Django still decides visibility, price and inventory. */
export function detailEvidence(
  value: unknown,
  requestedId: string,
): StorefrontProductDetail {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    value.id.toLowerCase() !== requestedId.toLowerCase() ||
    !isText(value.title) ||
    typeof value.slug !== "string" ||
    typeof value.description !== "string" ||
    typeof value.short_description !== "string" ||
    !isDecimal(value.starting_price) ||
    !optionalPrice(value.compare_at_price) ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    typeof value.in_stock !== "boolean" ||
    !isCount(value.total_available_stock) ||
    !isRating(value.average_rating) ||
    !isCount(value.review_count) ||
    !isRecord(value.seller) ||
    !isUuid(value.seller.id) ||
    !isText(value.seller.name) ||
    !isText(value.seller.store_name) ||
    !isRating(value.seller.rating)
  )
    throw new Error("Invalid product detail");
  categoryEvidence([value.category], 1);
  if (
    value.brand !== null &&
    (!isRecord(value.brand) ||
      !isUuid(value.brand.id) ||
      !isText(value.brand.name) ||
      typeof value.brand.slug !== "string" ||
      !isCount(value.brand.product_count))
  )
    throw new Error("Invalid product detail");
  // The backend permits ten active images. Do not truncate purchasable options silently.
  for (const image of boundedRows(value.images, 10)) {
    const expected = `/api/v1/storefront/products/${value.id}/images/${image.id}/`;
    if (
      typeof image.url !== "string" ||
      image.url.toLowerCase() !== expected.toLowerCase() ||
      typeof image.alt_text !== "string" ||
      !isCount(image.sort_order)
    )
      throw new Error("Invalid product image");
  }
  const variants = boundedRows(value.variants, 1000);
  let total = 0;
  for (const variant of variants) {
    if (
      !isText(variant.sku) ||
      !isDecimal(variant.price) ||
      !optionalPrice(variant.compare_at_price) ||
      !isCount(variant.available_quantity) ||
      variant.in_stock !== variant.available_quantity > 0 ||
      !isRecord(variant.attributes) ||
      Object.keys(variant.attributes).length > 100 ||
      !Object.entries(variant.attributes).every(
        ([key, item]) => isText(key) && isText(item),
      )
    )
      throw new Error("Invalid product option");
    total += variant.available_quantity;
  }
  if (
    !Number.isSafeInteger(total) ||
    total !== value.total_available_stock ||
    value.in_stock !== total > 0
  )
    throw new Error("Invalid product availability");
  if (
    !isRecord(value.rating_breakdown) ||
    Object.keys(value.rating_breakdown).some((key) => !/^[1-5]$/.test(key)) ||
    ![1, 2, 3, 4, 5].every((rating) =>
      isCount(
        (value.rating_breakdown as Record<string, unknown>)[String(rating)],
      ),
    ) ||
    Object.values(value.rating_breakdown).reduce<number>(
      (sum, item) => sum + (item as number),
      0,
    ) !== value.review_count ||
    (value.review_count === 0
      ? value.average_rating !== null
      : value.average_rating === null || value.average_rating === 0)
  )
    throw new Error("Invalid product ratings");
  const reviews = boundedRows(value.recent_reviews, 10);
  if (reviews.length > value.review_count)
    throw new Error("Invalid product reviews");
  for (const review of reviews) {
    if (
      !isText(review.customer_name) ||
      typeof review.title !== "string" ||
      typeof review.body !== "string" ||
      !isCount(review.rating) ||
      review.rating < 1 ||
      review.rating > 5 ||
      typeof review.verified_purchase !== "boolean" ||
      !timestamp(review.created_at) ||
      !(
        review.seller_response === null ||
        typeof review.seller_response === "string"
      ) ||
      !(
        review.seller_response_at === null ||
        timestamp(review.seller_response_at)
      )
    )
      throw new Error("Invalid product review");
  }
  return value as unknown as StorefrontProductDetail;
}

export function previousPrice(price: string, previous: string | null) {
  if (previous === null) return null;
  const places = Math.max(
    price.split(".")[1]?.length ?? 0,
    previous.split(".")[1]?.length ?? 0,
  );
  const units = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(places, "0"));
  };
  return units(previous) > units(price) ? previous : null;
}
