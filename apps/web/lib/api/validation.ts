import type {
  CurrentUser,
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
