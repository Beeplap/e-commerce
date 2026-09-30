import type { CurrentUser, Page, SellerMembership } from "@/lib/api/types";

export const user: CurrentUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "operator@example.com",
  first_name: "Alex",
  last_name: "River",
  is_email_verified: true,
  platform_permissions: [],
};

export const membership: SellerMembership = {
  id: "20000000-0000-4000-8000-000000000001",
  status: "active",
  seller: {
    id: "30000000-0000-4000-8000-000000000001",
    display_name: "Seller A",
    slug: "seller-a",
    status: "active",
    verification_status: "verified",
    default_currency: "USD",
    timezone: "UTC",
  },
  role: {
    id: "40000000-0000-4000-8000-000000000001",
    name: "OWNER",
    is_owner: true,
  },
  permissions: ["seller.context.read", "staff.read"],
};
export const secondMembership: SellerMembership = {
  ...membership,
  id: "20000000-0000-4000-8000-000000000002",
  seller: {
    ...membership.seller,
    id: "30000000-0000-4000-8000-000000000002",
    display_name: "Seller B",
    slug: "seller-b",
  },
  role: { ...membership.role, name: "FINANCE_MANAGER", is_owner: false },
  permissions: ["seller.context.read", "finance.read"],
};

export function page(
  results: SellerMembership[] = [membership],
): Page<SellerMembership> {
  return { count: results.length, next: null, previous: null, results };
}

export const csrf = "a".repeat(64);
export function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
