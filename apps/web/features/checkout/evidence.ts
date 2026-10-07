import { ApiError } from "@/lib/api/client";
import type {
  CartResponse,
  CheckoutQuote,
  CustomerAddress,
  PaymentRecord,
} from "@/lib/api/types";
import {
  isCount,
  isDecimal,
  isRecord,
  isText,
  isUuid,
} from "../storefront/catalog-evidence";

export type OrderEvidence = {
  id: string;
  number: string;
  amount: string;
  currency: string;
  paymentStatus: string;
};
const currencyValid = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value);
const textValid = (value: unknown, maximum = 255): value is string =>
  isText(value) && value.length <= maximum;
function invalid(message: string): never {
  throw new ApiError(message, 0);
}

/** Compare server evidence exactly. These checks never set prices or charges. */
function equalAmounts(
  positive: string[],
  negative: string[],
  expected: string,
  multiplier = 1,
) {
  const places = Math.max(
    ...[...positive, ...negative, expected].map(
      (value) => value.split(".")[1]?.length ?? 0,
    ),
  );
  const units = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(places, "0"));
  };
  return (
    positive.reduce((sum, value) => sum + units(value), BigInt(0)) *
      BigInt(multiplier) -
      negative.reduce((sum, value) => sum + units(value), BigInt(0)) ===
    units(expected)
  );
}
export function addressesEvidence(value: unknown): CustomerAddress[] {
  if (!Array.isArray(value) || value.length > 1000)
    return invalid(
      "Saved addresses could not be verified. Try loading them again.",
    );
  const ids = new Set<string>();
  for (const address of value as unknown[]) {
    if (
      !isRecord(address) ||
      !isUuid(address.id) ||
      ids.has(address.id.toLowerCase()) ||
      typeof address.is_default !== "boolean" ||
      !textValid(address.full_name, 120) ||
      !textValid(address.phone, 32) ||
      !textValid(address.line1) ||
      typeof address.line2 !== "string" ||
      address.line2.length > 255 ||
      !textValid(address.city, 100) ||
      !textValid(address.state, 100) ||
      !textValid(address.postal_code, 32) ||
      typeof address.country !== "string" ||
      !/^[A-Z]{2}$/.test(address.country)
    )
      return invalid(
        "Saved addresses could not be verified. Try loading them again.",
      );
    ids.add(address.id.toLowerCase());
  }
  return value as CustomerAddress[];
}

export function quoteEvidence(
  value: unknown,
  cart: CartResponse,
  selections: Record<string, string>,
): CheckoutQuote {
  const reject = () =>
    invalid(
      "Order review could not be verified. Refresh the quote before placing your order.",
    );
  if (
    !isRecord(value) ||
    !isCount(value.total_items) ||
    value.total_items !== cart.total_items ||
    !currencyValid(value.currency) ||
    value.currency !== cart.currency ||
    !Array.isArray(value.sellers) ||
    value.sellers.length !== cart.sellers.length ||
    ![
      value.subtotal,
      value.shipping_total,
      value.discount_total,
      value.tax_total,
      value.grand_total,
    ].every(isDecimal)
  )
    return reject();
  const sellers = new Set<string>();
  const subtotals: string[] = [],
    shipping: string[] = [],
    discounts: string[] = [],
    taxes: string[] = [],
    totals: string[] = [];
  for (const seller of value.sellers as unknown[]) {
    if (
      !isRecord(seller) ||
      !isUuid(seller.seller_id) ||
      sellers.has(seller.seller_id) ||
      !textValid(seller.seller_name) ||
      ![
        seller.subtotal,
        seller.shipping_fee,
        seller.discount_amount,
        seller.tax_amount,
        seller.total,
      ].every(isDecimal) ||
      !Array.isArray(seller.items) ||
      !Array.isArray(seller.available_shipping_methods) ||
      !seller.available_shipping_methods.length ||
      seller.available_shipping_methods.length > 100
    )
      return reject();
    const cartSeller = cart.sellers.find(
      (entry) => entry.seller_id === seller.seller_id,
    );
    if (!cartSeller || seller.items.length !== cartSeller.items.length)
      return reject();
    sellers.add(seller.seller_id);
    const methods = new Set<string>();
    for (const option of seller.available_shipping_methods as unknown[]) {
      if (
        !isRecord(option) ||
        !isUuid(option.method_id) ||
        methods.has(option.method_id) ||
        !textValid(option.name) ||
        !textValid(option.carrier) ||
        !isCount(option.min_days) ||
        !isCount(option.max_days) ||
        option.min_days > option.max_days ||
        !isDecimal(option.rate)
      )
        return reject();
      methods.add(option.method_id);
    }
    const chosen = seller.selected_shipping_method;
    if (!isRecord(chosen) || !isUuid(chosen.method_id)) return reject();
    const option = seller.available_shipping_methods.find(
      (entry) => isRecord(entry) && entry.method_id === chosen.method_id,
    );
    if (
      !isRecord(option) ||
      ["name", "carrier", "min_days", "max_days", "rate"].some(
        (field) => chosen[field] !== option[field],
      ) ||
      chosen.rate !== seller.shipping_fee ||
      (selections[seller.seller_id] &&
        selections[seller.seller_id] !== chosen.method_id)
    )
      return reject();
    const lines: string[] = [],
      items = new Set<string>();
    for (const item of seller.items as unknown[]) {
      if (
        !isRecord(item) ||
        !isUuid(item.item_id) ||
        items.has(item.item_id) ||
        !textValid(item.product_title) ||
        !textValid(item.sku) ||
        !isCount(item.quantity) ||
        !isCount(item.available_stock) ||
        item.is_in_stock !== item.available_stock >= item.quantity ||
        !isDecimal(item.unit_price) ||
        !isDecimal(item.line_subtotal)
      )
        return reject();
      const original = cartSeller.items.find(
        (entry) => entry.id === item.item_id,
      );
      if (
        !original ||
        item.variant_id !== original.variant_id ||
        item.product_id !== original.product_id ||
        item.quantity !== original.quantity ||
        !equalAmounts([item.unit_price], [], item.line_subtotal, item.quantity)
      )
        return reject();
      items.add(item.item_id);
      lines.push(item.line_subtotal);
    }
    const data = seller as unknown as CheckoutQuote["sellers"][number];
    if (
      !equalAmounts(lines, [], data.subtotal) ||
      !equalAmounts(
        [data.subtotal, data.shipping_fee, data.tax_amount],
        [data.discount_amount],
        data.total,
      )
    )
      return reject();
    subtotals.push(data.subtotal);
    shipping.push(data.shipping_fee);
    discounts.push(data.discount_amount);
    taxes.push(data.tax_amount);
    totals.push(data.total);
  }
  const quote = value as unknown as CheckoutQuote;
  if (
    !equalAmounts(subtotals, [], quote.subtotal) ||
    !equalAmounts(shipping, [], quote.shipping_total) ||
    !equalAmounts(discounts, [], quote.discount_total) ||
    !equalAmounts(taxes, [], quote.tax_total) ||
    !equalAmounts(totals, [], quote.grand_total)
  )
    return reject();
  return quote;
}

function orderEvidence(
  id: unknown,
  number: unknown,
  amount: unknown,
  currency: unknown,
  status: unknown,
): OrderEvidence {
  if (
    !isUuid(id) ||
    !textValid(number, 100) ||
    !isDecimal(amount) ||
    !currencyValid(currency) ||
    typeof status !== "string" ||
    !["pending", "authorized", "paid", "failed", "refunded"].includes(status)
  )
    return invalid(
      "Order details could not be verified. Check your order before continuing.",
    );
  return { id, number, amount, currency, paymentStatus: status };
}
export function placedEvidence(value: unknown): OrderEvidence {
  if (!isRecord(value))
    return invalid(
      "The order response could not be verified. Check your orders before trying again.",
    );
  return orderEvidence(
    value.order_id,
    value.order_number,
    value.grand_total,
    value.currency,
    value.payment_status,
  );
}
export function customerOrderEvidence(
  value: unknown,
  expectedId: string,
): OrderEvidence {
  if (!isRecord(value) || value.id !== expectedId)
    return invalid(
      "Order details could not be verified. Check your order before continuing.",
    );
  return orderEvidence(
    value.id,
    value.order_number,
    value.grand_total,
    value.currency,
    value.payment_status,
  );
}
export function paymentEvidence(
  value: PaymentRecord,
  orderId: string,
  expected?: PaymentRecord,
): PaymentRecord {
  if (
    !isUuid(value.payment_id) ||
    value.order_id !== orderId ||
    !textValid(value.order_number, 100) ||
    !isDecimal(value.amount) ||
    !currencyValid(value.currency) ||
    (expected &&
      (expected.payment_id !== value.payment_id ||
        expected.amount !== value.amount ||
        expected.currency !== value.currency))
  )
    return invalid(
      "Payment details could not be verified. Check your order status before trying again.",
    );
  return value;
}
export function orderIdFromQuery(query: {
  getAll: (name: string) => string[];
}) {
  const values = query.getAll("order_id");
  return values.length === 1 && isUuid(values[0]) ? values[0] : null;
}
