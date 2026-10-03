import type {
  CurrentUser,
  CustomerOrderDetail,
  CustomerOrderListItem,
  CustomerPackage,
  CustomerProfile,
  CustomerReturnRecord,
  CustomerReviewRecord,
  Page,
  PaymentRecord,
  PaymentStatus,
  SellerMembership,
} from "./types";

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === "string")
  );
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function invalidResponse(): never {
  throw new Error("The server returned an unexpected response.");
}

const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
];
const DECIMAL = /^-?\d+(?:\.\d+)?$/;

export function parsePayment(value: unknown): PaymentRecord {
  if (
    !record(value) ||
    !isUuid(value.payment_id) ||
    !isUuid(value.order_id) ||
    typeof value.order_number !== "string" ||
    typeof value.amount !== "string" ||
    !DECIMAL.test(value.amount) ||
    typeof value.currency !== "string" ||
    !PAYMENT_STATUSES.includes(value.status as PaymentStatus) ||
    typeof value.provider !== "string" ||
    typeof value.error_code !== "string" ||
    typeof value.error_message !== "string" ||
    typeof value.created_at !== "string"
  )
    return invalidResponse();
  return {
    payment_id: value.payment_id,
    order_id: value.order_id,
    order_number: value.order_number,
    amount: value.amount,
    currency: value.currency,
    status: value.status as PaymentStatus,
    provider: value.provider,
    error_code: value.error_code,
    error_message: value.error_message,
    created_at: value.created_at,
  };
}

export function parseUser(value: unknown): CurrentUser {
  if (
    !record(value) ||
    !isUuid(value.id) ||
    typeof value.email !== "string" ||
    typeof value.first_name !== "string" ||
    typeof value.last_name !== "string" ||
    typeof value.is_email_verified !== "boolean" ||
    !strings(value.platform_permissions)
  ) {
    return invalidResponse();
  }
  return {
    id: value.id,
    email: value.email,
    first_name: value.first_name,
    last_name: value.last_name,
    is_email_verified: value.is_email_verified,
    platform_permissions: value.platform_permissions,
  };
}

export function parseMembership(value: unknown): SellerMembership {
  if (
    !record(value) ||
    !isUuid(value.id) ||
    !strings(value.permissions) ||
    !["invited", "active", "suspended"].includes(String(value.status))
  )
    return invalidResponse();
  const seller = value.seller;
  const role = value.role;
  if (
    !record(seller) ||
    !isUuid(seller.id) ||
    typeof seller.display_name !== "string" ||
    typeof seller.slug !== "string" ||
    typeof seller.default_currency !== "string" ||
    typeof seller.timezone !== "string" ||
    !["pending", "active", "suspended", "rejected", "closed"].includes(
      String(seller.status),
    ) ||
    !["pending", "verified", "rejected"].includes(
      String(seller.verification_status),
    ) ||
    !record(role) ||
    !isUuid(role.id) ||
    typeof role.name !== "string" ||
    typeof role.is_owner !== "boolean"
  ) {
    return invalidResponse();
  }
  return {
    id: value.id,
    status: value.status as SellerMembership["status"],
    permissions: value.permissions,
    seller: {
      id: seller.id,
      display_name: seller.display_name,
      slug: seller.slug,
      status: seller.status as SellerMembership["seller"]["status"],
      verification_status:
        seller.verification_status as SellerMembership["seller"]["verification_status"],
      default_currency: seller.default_currency,
      timezone: seller.timezone,
    },
    role: { id: role.id, name: role.name, is_owner: role.is_owner },
  };
}

export function parseMembershipPage(value: unknown): Page<SellerMembership> {
  if (
    !record(value) ||
    typeof value.count !== "number" ||
    !Number.isSafeInteger(value.count) ||
    value.count < 0 ||
    !(value.next === null || typeof value.next === "string") ||
    !(value.previous === null || typeof value.previous === "string") ||
    !Array.isArray(value.results) ||
    value.results.length > 25
  )
    return invalidResponse();
  return {
    count: value.count,
    next: value.next,
    previous: value.previous,
    results: value.results.map(parseMembership),
  };
}

export function parseCsrf(value: unknown): string {
  if (
    !record(value) ||
    typeof value.csrf_token !== "string" ||
    !/^[a-zA-Z0-9]{64}$/.test(value.csrf_token)
  ) {
    return invalidResponse();
  }
  return value.csrf_token;
}

export function parseCustomerProfile(value: unknown): CustomerProfile {
  if (
    !record(value) ||
    !isUuid(value.id) ||
    typeof value.email !== "string" ||
    typeof value.first_name !== "string" ||
    typeof value.last_name !== "string" ||
    typeof value.phone !== "string" ||
    typeof value.is_email_verified !== "boolean" ||
    typeof value.created_at !== "string"
  ) {
    return invalidResponse();
  }
  return {
    id: value.id,
    email: value.email,
    first_name: value.first_name,
    last_name: value.last_name,
    phone: value.phone,
    is_email_verified: value.is_email_verified,
    created_at: value.created_at,
  };
}

export function parseCustomerOrderList(
  value: unknown,
): Page<CustomerOrderListItem> {
  if (
    !record(value) ||
    typeof value.count !== "number" ||
    !Array.isArray(value.results)
  ) {
    return invalidResponse();
  }
  return {
    count: value.count,
    next: typeof value.next === "string" ? value.next : null,
    previous: typeof value.previous === "string" ? value.previous : null,
    results: value.results as CustomerOrderListItem[],
  };
}

export function parseCustomerOrderDetail(value: unknown): CustomerOrderDetail {
  if (
    !record(value) ||
    !isUuid(value.id) ||
    typeof value.order_number !== "string" ||
    typeof value.created_at !== "string" ||
    typeof value.status !== "string" ||
    typeof value.payment_status !== "string" ||
    typeof value.fulfillment_status !== "string" ||
    typeof value.subtotal !== "string" ||
    typeof value.shipping_total !== "string" ||
    typeof value.discount_total !== "string" ||
    typeof value.grand_total !== "string" ||
    typeof value.currency !== "string" ||
    !Array.isArray(value.packages)
  ) {
    return invalidResponse();
  }
  return {
    id: value.id,
    order_number: value.order_number,
    created_at: value.created_at,
    status: value.status,
    payment_status: value.payment_status,
    fulfillment_status: value.fulfillment_status,
    subtotal: value.subtotal,
    shipping_total: value.shipping_total,
    discount_total: value.discount_total,
    grand_total: value.grand_total,
    currency: value.currency,
    shipping_address: record(value.shipping_address)
      ? value.shipping_address
      : {},
    billing_address: record(value.billing_address) ? value.billing_address : {},
    packages: value.packages as CustomerPackage[],
  };
}

export function parseCustomerReview(value: unknown): CustomerReviewRecord {
  if (
    !record(value) ||
    !isUuid(value.id) ||
    !isUuid(value.product_id) ||
    typeof value.rating !== "number" ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    typeof value.status !== "string" ||
    typeof value.verified_purchase !== "boolean" ||
    typeof value.created_at !== "string"
  ) {
    return invalidResponse();
  }
  return {
    id: value.id,
    product_id: value.product_id,
    rating: value.rating,
    title: value.title,
    body: value.body,
    status: value.status,
    verified_purchase: value.verified_purchase,
    created_at: value.created_at,
  };
}

export function parseCustomerReturn(value: unknown): CustomerReturnRecord {
  if (
    !record(value) ||
    !isUuid(value.id) ||
    typeof value.return_number !== "string" ||
    !isUuid(value.seller_order_id) ||
    typeof value.seller_name !== "string" ||
    typeof value.status !== "string" ||
    typeof value.reason !== "string" ||
    typeof value.customer_notes !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return invalidResponse();
  }
  return {
    id: value.id,
    return_number: value.return_number,
    seller_order_id: value.seller_order_id,
    seller_name: value.seller_name,
    status: value.status,
    reason: value.reason,
    customer_notes: value.customer_notes,
    created_at: value.created_at,
  };
}
