import type { FieldErrors } from "./types";
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
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions<T>,
): Promise<T> {
  // Keep cookies and CSRF material inside this origin, even for future callers.
  if (
    !/^\/api\/v1\/[a-zA-Z0-9/?=&._-]+$/.test(path) ||
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
      ...(method !== "GET" ? { body: JSON.stringify(options.body ?? {}) } : {}),
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
};
