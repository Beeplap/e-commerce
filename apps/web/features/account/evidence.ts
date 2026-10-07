import { ApiError } from "@/lib/api/client";
import type {
  CustomerOrderDetail,
  CustomerOrderListItem,
  CustomerProfile,
  Page,
} from "@/lib/api/types";
import {
  isCount,
  isDecimal,
  isRecord,
  isUuid,
} from "@/features/storefront/catalog-evidence";

const text = (value: unknown, maximum = 255): value is string =>
  typeof value === "string" && value.length <= maximum;
const date = (value: unknown) =>
  typeof value === "string" &&
  value.length <= 40 &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  /(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
  Number.isFinite(new Date(value).getTime());
const money = (value: unknown) => isDecimal(value) && value.length <= 64;
const currency = (value: unknown) =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value);
const positive = (value: unknown) => isCount(value) && value > 0;
function reject(): never {
  throw new ApiError(
    "Account information could not be verified. Try loading it again.",
    0,
  );
}
export function profileEvidence(value: CustomerProfile, userId: string) {
  if (
    value.id !== userId ||
    !text(value.email, 254) ||
    !value.email.includes("@") ||
    !text(value.first_name, 150) ||
    !text(value.last_name, 150) ||
    !text(value.phone, 32) ||
    typeof value.is_email_verified !== "boolean" ||
    !date(value.created_at)
  )
    reject();
  return value;
}
export function ordersEvidence(value: Page<CustomerOrderListItem>) {
  if (
    !isCount(value.count) ||
    !Array.isArray(value.results) ||
    value.results.length > 25 ||
    value.count < value.results.length ||
    !(value.next === null || text(value.next, 2048)) ||
    !(value.previous === null || text(value.previous, 2048))
  )
    reject();
  const ids = new Set<string>();
  for (const order of value.results) {
    if (
      !isRecord(order) ||
      !isUuid(order.id) ||
      ids.has(order.id.toLowerCase()) ||
      !text(order.order_number) ||
      !date(order.created_at) ||
      !text(order.status, 64) ||
      !text(order.payment_status, 64) ||
      !text(order.fulfillment_status, 64) ||
      !money(order.grand_total) ||
      !currency(order.currency) ||
      !isCount(order.total_items) ||
      !isCount(order.packages_count) ||
      !Array.isArray(order.items_preview) ||
      order.items_preview.length > 3
    )
      reject();
    ids.add(order.id.toLowerCase());
    const items = new Set<string>();
    for (const item of order.items_preview) {
      if (
        !isRecord(item) ||
        !isUuid(item.id) ||
        items.has(item.id) ||
        !text(item.product_title) ||
        !text(item.variant_name) ||
        !positive(item.quantity) ||
        !money(item.unit_price)
      )
        reject();
      items.add(item.id);
    }
  }
  return value;
}
export function orderEvidence(value: CustomerOrderDetail, expectedId: string) {
  if (
    value.id.toLowerCase() !== expectedId.toLowerCase() ||
    !isUuid(value.id) ||
    !text(value.order_number) ||
    !date(value.created_at) ||
    !text(value.status, 64) ||
    !text(value.payment_status, 64) ||
    !text(value.fulfillment_status, 64) ||
    !currency(value.currency) ||
    ![
      value.subtotal,
      value.shipping_total,
      value.discount_total,
      value.grand_total,
    ].every(money) ||
    !Array.isArray(value.packages) ||
    value.packages.length > 200
  )
    reject();
  const packages = new Set<string>(),
    items = new Set<string>(),
    events = new Set<string>();
  for (const pkg of value.packages) {
    if (
      !isRecord(pkg) ||
      !isUuid(pkg.seller_order_id) ||
      packages.has(pkg.seller_order_id) ||
      !isUuid(pkg.seller_id) ||
      !text(pkg.seller_name) ||
      !text(pkg.status, 64) ||
      !text(pkg.carrier) ||
      !text(pkg.tracking_number) ||
      !Array.isArray(pkg.items) ||
      pkg.items.length > 1000 ||
      !Array.isArray(pkg.tracking_events) ||
      pkg.tracking_events.length > 1000
    )
      reject();
    packages.add(pkg.seller_order_id);
    for (const item of pkg.items) {
      if (
        !isRecord(item) ||
        !isUuid(item.id) ||
        items.has(item.id) ||
        !text(item.product_title) ||
        !text(item.variant_name) ||
        !text(item.sku) ||
        !positive(item.quantity) ||
        !money(item.unit_price) ||
        !money(item.total_price) ||
        typeof item.can_review !== "boolean" ||
        typeof item.can_return !== "boolean"
      )
        reject();
      items.add(item.id);
    }
    for (const event of pkg.tracking_events) {
      if (
        !isRecord(event) ||
        !isUuid(event.id) ||
        events.has(event.id) ||
        !text(event.status, 64) ||
        !text(event.location) ||
        !text(event.description, 2000) ||
        !date(event.timestamp)
      )
        reject();
      events.add(event.id);
    }
  }
  for (const address of [value.shipping_address, value.billing_address]) {
    if (!isRecord(address)) reject();
    for (const key of [
      "full_name",
      "line1",
      "line2",
      "city",
      "state",
      "postal_code",
      "country",
      "phone",
    ])
      if (address[key] !== undefined && !text(address[key])) reject();
  }
  return value;
}
