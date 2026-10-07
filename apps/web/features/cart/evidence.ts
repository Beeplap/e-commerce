import type { CartResponse, CouponValidationResult } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import {
  isCount,
  isDecimal,
  isRecord,
  isText,
  isUuid,
} from "../storefront/catalog-evidence";

function units(value: string, places: number) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(places, "0"));
}
function sameAmounts(values: string[], expected: string, multiplier = 1) {
  const places = Math.max(
    ...[...values, expected].map((value) => value.split(".")[1]?.length ?? 0),
  );
  return (
    values.reduce((sum, value) => sum + units(value, places), BigInt(0)) *
      BigInt(multiplier) ===
    units(expected, places)
  );
}

/** Validate presentation evidence; Django still owns prices, inventory and cart identity. */
export function cartEvidence(value: unknown): CartResponse {
  const invalid = () => {
    throw new ApiError(
      "Cart information is invalid. Please reload your cart.",
      0,
    );
  };
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !isCount(value.total_items) ||
    !isCount(value.total_unique_items) ||
    !isDecimal(value.subtotal) ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    typeof value.has_out_of_stock_items !== "boolean" ||
    !Array.isArray(value.sellers) ||
    value.sellers.length > 1000
  )
    return invalid();
  const sellers = new Set<string>(),
    items = new Set<string>(),
    variants = new Set<string>();
  let count = 0,
    unavailable = false;
  const subtotals: string[] = [];
  for (const seller of value.sellers as unknown[]) {
    if (
      !isRecord(seller) ||
      !isUuid(seller.seller_id) ||
      sellers.has(seller.seller_id.toLowerCase()) ||
      !isText(seller.seller_name) ||
      typeof seller.seller_slug !== "string" ||
      !isDecimal(seller.subtotal) ||
      !isCount(seller.item_count) ||
      !Array.isArray(seller.items) ||
      !seller.items.length ||
      seller.items.length > 1000
    )
      return invalid();
    sellers.add(seller.seller_id.toLowerCase());
    let sellerCount = 0;
    const lines: string[] = [];
    for (const item of seller.items as unknown[]) {
      if (
        !isRecord(item) ||
        !isUuid(item.id) ||
        items.has(item.id.toLowerCase()) ||
        !isUuid(item.variant_id) ||
        variants.has(item.variant_id.toLowerCase()) ||
        !isUuid(item.product_id) ||
        !isText(item.product_title) ||
        typeof item.product_slug !== "string" ||
        !isText(item.variant_name) ||
        !isText(item.sku) ||
        !isDecimal(item.unit_price) ||
        !(item.compare_at_price === null || isDecimal(item.compare_at_price)) ||
        !isDecimal(item.line_subtotal) ||
        !isCount(item.quantity) ||
        item.quantity < 1 ||
        !isCount(item.available_stock) ||
        item.is_available !==
          (item.available_stock > 0 && item.available_stock >= item.quantity) ||
        !(item.stock_warning === null || isText(item.stock_warning))
      )
        return invalid();
      if (
        item.thumbnail_url !== null &&
        (typeof item.thumbnail_url !== "string" ||
          !new RegExp(
            `^/api/v1/storefront/products/${item.product_id}/images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/?$`,
            "i",
          ).test(item.thumbnail_url))
      )
        return invalid();
      if (!sameAmounts([item.unit_price], item.line_subtotal, item.quantity))
        return invalid();
      items.add(item.id.toLowerCase());
      variants.add(item.variant_id.toLowerCase());
      if (items.size > 1000) return invalid();
      sellerCount += item.quantity;
      unavailable ||= !item.is_available;
      lines.push(item.line_subtotal);
    }
    if (
      !Number.isSafeInteger(sellerCount) ||
      sellerCount !== seller.item_count ||
      !sameAmounts(lines, seller.subtotal)
    )
      return invalid();
    count += sellerCount;
    subtotals.push(seller.subtotal);
  }
  if (
    !Number.isSafeInteger(count) ||
    count !== value.total_items ||
    items.size !== value.total_unique_items ||
    unavailable !== value.has_out_of_stock_items ||
    !sameAmounts(subtotals, value.subtotal)
  )
    return invalid();
  return value as unknown as CartResponse;
}

export function couponEvidence(
  value: unknown,
  subtotal: string,
): Pick<CouponValidationResult, "valid" | "discount_amount" | "error_message"> {
  if (
    !isRecord(value) ||
    typeof value.valid !== "boolean" ||
    !isDecimal(value.discount_amount) ||
    !(value.error_message === null || typeof value.error_message === "string")
  )
    throw new ApiError("The code preview could not be verified. Try again.", 0);
  const places = Math.max(
    value.discount_amount.split(".")[1]?.length ?? 0,
    subtotal.split(".")[1]?.length ?? 0,
  );
  if (
    units(value.discount_amount, places) > units(subtotal, places) ||
    (!value.valid && units(value.discount_amount, places) !== BigInt(0))
  )
    throw new ApiError("The code preview could not be verified. Try again.", 0);
  return {
    valid: value.valid,
    discount_amount: value.discount_amount,
    error_message: value.error_message,
  };
}
