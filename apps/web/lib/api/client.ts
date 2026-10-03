import type {
  FieldErrors,
  StaffMember,
  SellerRole,
  Promotion,
  Coupon,
  ProductReview,
  Notification,
  NotificationUnreadCount,
  SellerDashboardMetrics,
  PlatformDashboardMetrics,
  Page,
  StorefrontCategory,
  StorefrontBrand,
  StorefrontProductCard,
  StorefrontProductDetail,
  StorefrontSellerDetail,
} from "./types";

import {
  isUuid,
  parseCsrf,
  parseMembership,
  parseMembershipPage,
  parseUser,
  record,
  strings,
} from "./validation";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: FieldErrors = {},
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "We couldn’t complete the request. Please try again.";
}

export function isAbort(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) &&
    error.name === "AbortError"
  );
}

function serverError(
  status: number,
  body: unknown,
  requestId: string | null,
): ApiError {
  const fields: FieldErrors = {};
  if (status < 500 && record(body)) {
    for (const [name, errors] of Object.entries(body)) {
      if (
        strings(errors) &&
        !["__proto__", "constructor", "prototype"].includes(name)
      )
        fields[name] = errors;
    }
  }
  // Never surface raw HTML, exception payloads or server error details.
  let message =
    status >= 500
      ? "The service is temporarily unavailable. Please try again."
      : status === 429
        ? "Too many attempts. Please try again later."
        : status === 403
          ? "You don’t have permission to perform this action."
          : status === 404
            ? "This resource is unavailable."
            : "Please check the submitted information.";
  if (status < 500 && record(body) && typeof body.detail === "string")
    message = body.detail;
  return new ApiError(message, status, fields, requestId);
}

interface RequestOptions<T> {
  parse: (value: unknown) => T;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  sellerId?: string;
  signal?: AbortSignal;
  expectedStatus?: number;
  responseType?: "json" | "blob";
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions<T>,
): Promise<T> {
  // Keep cookies and CSRF material inside this origin, even for future callers.
  if (
    !/^\/api\/v1\/[a-zA-Z0-9/._-]+(?:\?[a-zA-Z0-9%+?=&._-]*)?$/.test(path) ||
    path
      .split("?")[0]
      ?.split("/")
      .some((segment) => [".", ".."].includes(segment))
  ) {
    throw new ApiError("An invalid API path was requested.", 0);
  }
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });
  if (options.sellerId !== undefined) {
    if (!isUuid(options.sellerId))
      throw new ApiError("Select a valid seller.", 0);
    headers.set("X-Seller-ID", options.sellerId);
  }
  if (method !== "GET") {
    // Acquire a fresh token before every unsafe action; login rotates CSRF cookies.
    const csrf = await apiRequest("/api/v1/auth/csrf", {
      parse: parseCsrf,
      signal: options.signal,
    });
    headers.set("X-CSRFToken", csrf);
    if (!(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal: options.signal,
      ...(method !== "GET"
        ? {
            body:
              options.body instanceof FormData
                ? options.body
                : JSON.stringify(options.body ?? {}),
          }
        : {}),
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError("We couldn’t reach the service. Please try again.", 0);
  }
  let body: unknown = null;
  if (
    response.status !== 204 &&
    response.headers.get("content-type")?.includes("application/json")
  ) {
    try {
      body = await response.json();
    } catch {
      throw new ApiError(
        "The server returned an unexpected response.",
        response.status,
      );
    }
  }
  const requestId = response.headers.get("X-Request-ID");
  if (!response.ok) throw serverError(response.status, body, requestId);
  if (response.status !== (options.expectedStatus ?? 200)) {
    throw new ApiError(
      "The server returned an unexpected response.",
      response.status,
      {},
      requestId,
    );
  }
  if (options.responseType === "blob") {
    if (response.headers.get("content-type") !== "application/octet-stream")
      throw new ApiError(
        "The server returned an unexpected download.",
        response.status,
      );
    body = await response.blob();
  }
  try {
    return options.parse(body);
  } catch {
    throw new ApiError(
      "The server returned an unexpected response.",
      response.status,
      {},
      requestId,
    );
  }
}

export const authApi = {
  me: (signal?: AbortSignal) =>
    apiRequest("/api/v1/auth/me", { parse: parseUser, signal }),
  login: (email: string, password: string) =>
    apiRequest("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
      parse: parseUser,
    }),
  logout: () =>
    apiRequest("/api/v1/auth/logout", {
      method: "POST",
      expectedStatus: 204,
      parse: () => undefined,
    }),
  platformAccess: (signal?: AbortSignal) =>
    apiRequest("/api/v1/admin/access", { parse: parseUser, signal }),
};

export const sellerApi = {
  memberships: (page = 1, signal?: AbortSignal) => {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new ApiError("Invalid page number.", 0);
    return apiRequest(`/api/v1/seller/memberships?page=${page}`, {
      parse: parseMembershipPage,
      signal,
    });
  },
  access: (sellerId: string, signal?: AbortSignal) =>
    apiRequest("/api/v1/seller/access", {
      parse: parseMembership,
      sellerId,
      signal,
    }),

  // Staff
  staff: (sellerId: string, page = 1, signal?: AbortSignal) =>
    apiRequest(`/api/v1/seller/staff?page=${page}`, {
      parse: (v) => v as { count: number; results: StaffMember[] },
      sellerId,
      signal,
    }),
  inviteStaff: (sellerId: string, body: { email: string; role_id: string }) =>
    apiRequest("/api/v1/seller/staff/invite", {
      method: "POST",
      parse: (v) => v as StaffMember,
      sellerId,
      body,
    }),
  updateStaffRole: (
    sellerId: string,
    membershipId: string,
    body: { role_id: string },
  ) =>
    apiRequest(`/api/v1/seller/staff/${membershipId}/role`, {
      method: "PATCH",
      parse: (v) => v as StaffMember,
      sellerId,
      body,
    }),
  revokeStaff: (sellerId: string, membershipId: string) =>
    apiRequest(`/api/v1/seller/staff/${membershipId}/revoke`, {
      method: "POST",
      expectedStatus: 204,
      parse: () => undefined,
      sellerId,
    }),
  roles: (sellerId: string, signal?: AbortSignal) =>
    apiRequest("/api/v1/seller/roles", {
      parse: (v) => v as SellerRole[],
      sellerId,
      signal,
    }),
  assignablePermissions: (sellerId: string, signal?: AbortSignal) =>
    apiRequest("/api/v1/seller/roles/assignable-permissions", {
      parse: (v) => v as { permissions: string[] },
      sellerId,
      signal,
    }),
  createRole: (
    sellerId: string,
    body: { name: string; permissions: string[] },
  ) =>
    apiRequest("/api/v1/seller/roles", {
      method: "POST",
      expectedStatus: 201,
      parse: (v) => v as SellerRole,
      sellerId,
      body,
    }),
  updateRole: (
    sellerId: string,
    roleId: string,
    body: { name?: string; permissions?: string[] },
  ) =>
    apiRequest(`/api/v1/seller/roles/${roleId}`, {
      method: "PATCH",
      parse: (v) => v as SellerRole,
      sellerId,
      body,
    }),
  deleteRole: (sellerId: string, roleId: string) =>
    apiRequest(`/api/v1/seller/roles/${roleId}`, {
      method: "DELETE",
      expectedStatus: 204,
      parse: () => undefined,
      sellerId,
    }),

  // Promotions
  promotions: (sellerId: string, page = 1, signal?: AbortSignal) =>
    apiRequest(`/api/v1/promotions/?page=${page}`, {
      parse: (v) => v as { count: number; results: Promotion[] },
      sellerId,
      signal,
    }),
  createPromotion: (sellerId: string, body: Record<string, unknown>) =>
    apiRequest("/api/v1/promotions/", {
      method: "POST",
      expectedStatus: 201,
      parse: (v) => v as Promotion,
      sellerId,
      body,
    }),
  updatePromotion: (
    sellerId: string,
    id: string,
    body: Record<string, unknown>,
  ) =>
    apiRequest(`/api/v1/promotions/${id}/`, {
      method: "PATCH",
      parse: (v) => v as Promotion,
      sellerId,
      body,
    }),
  coupons: (
    sellerId: string,
    promotionId: string,
    page = 1,
    signal?: AbortSignal,
  ) =>
    apiRequest(`/api/v1/promotions/${promotionId}/coupons/?page=${page}`, {
      parse: (v) => v as { count: number; results: Coupon[] },
      sellerId,
      signal,
    }),
  createCoupon: (
    sellerId: string,
    promotionId: string,
    body: Record<string, unknown>,
  ) =>
    apiRequest(`/api/v1/promotions/${promotionId}/coupons/`, {
      method: "POST",
      expectedStatus: 201,
      parse: (v) => v as Coupon,
      sellerId,
      body,
    }),

  // Reviews
  reviews: (sellerId: string, page = 1, signal?: AbortSignal) =>
    apiRequest(`/api/v1/reviews/?page=${page}`, {
      parse: (v) => v as { count: number; results: ProductReview[] },
      sellerId,
      signal,
    }),
  respondToReview: (sellerId: string, reviewId: string, response: string) =>
    apiRequest(`/api/v1/reviews/${reviewId}/respond/`, {
      method: "POST",
      parse: (v) => v as ProductReview,
      sellerId,
      body: { response },
    }),
  reportReview: (sellerId: string, reviewId: string, reason: string) =>
    apiRequest(`/api/v1/reviews/${reviewId}/report/`, {
      method: "POST",
      expectedStatus: 201,
      parse: (v) => v as Record<string, unknown>,
      sellerId,
      body: { reason },
    }),
  dashboardMetrics: (
    sellerId: string,
    params?: { startDate?: string; endDate?: string },
    signal?: AbortSignal,
  ) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set("start_date", params.startDate);
    if (params?.endDate) search.set("end_date", params.endDate);
    const qs = search.toString();
    const url = qs
      ? `/api/v1/seller/analytics/dashboard?${qs}`
      : "/api/v1/seller/analytics/dashboard";
    return apiRequest(url, {
      parse: (v) => v as SellerDashboardMetrics,
      sellerId,
      signal,
    });
  },
};

// Notifications API (user-scoped, no seller context needed)
export const notificationsApi = {
  list: (page = 1, signal?: AbortSignal) =>
    apiRequest(`/api/v1/notifications/?page=${page}`, {
      parse: (v) => v as { count: number; results: Notification[] },
      signal,
    }),
  unreadCount: (signal?: AbortSignal) =>
    apiRequest("/api/v1/notifications/unread-count/", {
      parse: (v) => v as NotificationUnreadCount,
      signal,
    }),
  markRead: (notificationId: string) =>
    apiRequest(`/api/v1/notifications/${notificationId}/read/`, {
      method: "POST",
      parse: (v) => v as Notification,
    }),
  markAllRead: () =>
    apiRequest("/api/v1/notifications/read-all/", {
      method: "POST",
      expectedStatus: 204,
      parse: () => undefined,
    }),
};

// Admin Phase 10 APIs
export const adminApi = {
  promotions: (page = 1, signal?: AbortSignal) =>
    apiRequest(`/api/v1/admin/promotions/?page=${page}`, {
      parse: (v) => v as { count: number; results: Promotion[] },
      signal,
    }),
  createPromotion: (body: Record<string, unknown>) =>
    apiRequest("/api/v1/admin/promotions/", {
      method: "POST",
      expectedStatus: 201,
      parse: (v) => v as Promotion,
      body,
    }),
  reviews: (page = 1, status?: string, signal?: AbortSignal) => {
    const qs = status ? `page=${page}&status=${status}` : `page=${page}`;
    return apiRequest(`/api/v1/admin/reviews/?${qs}`, {
      parse: (v) => v as { count: number; results: ProductReview[] },
      signal,
    });
  },
  moderateReview: (
    reviewId: string,
    action: "publish" | "reject" | "remove",
    notes?: string,
  ) =>
    apiRequest(`/api/v1/admin/reviews/${reviewId}/moderate/`, {
      method: "POST",
      parse: (v) => v as ProductReview,
      body: { action, notes: notes ?? "" },
    }),
  dashboardMetrics: (
    params?: { startDate?: string; endDate?: string },
    signal?: AbortSignal,
  ) => {
    const search = new URLSearchParams();
    if (params?.startDate) search.set("start_date", params.startDate);
    if (params?.endDate) search.set("end_date", params.endDate);
    const qs = search.toString();
    const url = qs
      ? `/api/v1/admin/analytics/dashboard?${qs}`
      : "/api/v1/admin/analytics/dashboard";
    return apiRequest(url, {
      parse: (v) => v as PlatformDashboardMetrics,
      signal,
    });
  },
};

// Phase 17: Public Storefront APIs
export const storefrontApi = {
  categories: (signal?: AbortSignal) =>
    apiRequest("/api/v1/storefront/categories", {
      parse: (v) => v as StorefrontCategory[],
      signal,
    }),

  brands: (signal?: AbortSignal) =>
    apiRequest("/api/v1/storefront/brands", {
      parse: (v) => v as StorefrontBrand[],
      signal,
    }),

  products: (
    params?: {
      page?: number;
      category?: string;
      brand?: string;
      seller?: string;
      sort?: "newest" | "price_asc" | "price_desc" | "rating";
    },
    signal?: AbortSignal,
  ) => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.category) search.set("category", params.category);
    if (params?.brand) search.set("brand", params.brand);
    if (params?.seller) search.set("seller", params.seller);
    if (params?.sort) search.set("sort", params.sort);
    const qs = search.toString();
    const url = qs
      ? `/api/v1/storefront/products?${qs}`
      : "/api/v1/storefront/products";
    return apiRequest(url, {
      parse: (v) => v as Page<StorefrontProductCard>,
      signal,
    });
  },

  productDetail: (productId: string, signal?: AbortSignal) =>
    apiRequest(`/api/v1/storefront/products/${productId}`, {
      parse: (v) => v as StorefrontProductDetail,
      signal,
    }),

  sellerDetail: (sellerId: string, signal?: AbortSignal) =>
    apiRequest(`/api/v1/storefront/sellers/${sellerId}`, {
      parse: (v) => v as StorefrontSellerDetail,
      signal,
    }),
};
