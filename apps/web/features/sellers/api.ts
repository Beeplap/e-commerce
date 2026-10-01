import { apiRequest, ApiError } from "@/lib/api/client";
import { isUuid, record } from "@/lib/api/validation";
import type { Page, SellerSummary } from "@/lib/api/types";

export interface SellerRecord extends SellerSummary {
  legal_name: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
}
export interface Address {
  id: string;
  kind: "registered" | "returns";
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
}
export interface SellerDetail extends SellerRecord {
  profile: { description: string; website: string };
  settings: { support_email: string };
  addresses: Address[];
}
export interface SellerDocument {
  id: string;
  document_type: "registration" | "tax";
  content_type: string;
  size: number;
  status: "pending" | "verified" | "rejected";
  verified_by_id: string | null;
  verified_at: string | null;
  rejection_reason: string;
  expires_at: string | null;
  created_at: string;
}
export interface History {
  id: string;
  actor_id: string;
  from_status: string;
  to_status: string;
  reason: string;
  created_at: string;
}
export interface Audit {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  changes: Record<string, unknown>;
  created_at: string;
}
export interface Member {
  id: string;
  email: string;
  role_name: string;
  status: string;
  joined_at: string | null;
}

function object(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new Error("Invalid response");
  return value;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid response");
  return value;
}
function nullable(value: unknown): string | null {
  return value === null ? null : string(value);
}
function uuid(value: unknown): string {
  if (!isUuid(value)) throw new Error("Invalid identifier");
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== "string" || !choices.includes(value as T))
    throw new Error("Invalid response");
  return value as T;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid response");
  return value;
}
export function parseSeller(value: unknown): SellerRecord {
  const v = object(value);
  return {
    id: uuid(v.id),
    display_name: string(v.display_name),
    legal_name: string(v.legal_name),
    slug: string(v.slug),
    email: string(v.email),
    phone: string(v.phone),
    default_currency: string(v.default_currency),
    timezone: string(v.timezone),
    status: choice(v.status, [
      "pending",
      "active",
      "suspended",
      "rejected",
      "closed",
    ] as const),
    verification_status: choice(v.verification_status, [
      "pending",
      "verified",
      "rejected",
    ] as const),
    created_at: string(v.created_at),
    updated_at: string(v.updated_at),
    approved_at: nullable(v.approved_at),
    approved_by: v.approved_by === null ? null : uuid(v.approved_by),
  };
}
export function parseAddress(value: unknown): Address {
  const v = object(value);
  return {
    id: uuid(v.id),
    kind: choice(v.kind, ["registered", "returns"] as const),
    line1: string(v.line1),
    line2: string(v.line2),
    city: string(v.city),
    region: string(v.region),
    postal_code: string(v.postal_code),
    country: string(v.country),
  };
}
export function parseDetail(value: unknown): SellerDetail {
  const v = object(value),
    profile = object(v.profile),
    settings = object(v.settings);
  if (!Array.isArray(v.addresses) || v.addresses.length > 2)
    throw new Error("Invalid addresses");
  return {
    ...parseSeller(value),
    profile: {
      description: string(profile.description),
      website: string(profile.website),
    },
    settings: { support_email: string(settings.support_email) },
    addresses: v.addresses.map(parseAddress),
  };
}
export function parseDocument(value: unknown): SellerDocument {
  const v = object(value);
  return {
    id: uuid(v.id),
    document_type: choice(v.document_type, ["registration", "tax"] as const),
    content_type: choice(v.content_type, ["image/png", "image/jpeg"]),
    size: integer(v.size),
    status: choice(v.status, ["pending", "verified", "rejected"] as const),
    verified_by_id: v.verified_by_id === null ? null : uuid(v.verified_by_id),
    verified_at: nullable(v.verified_at),
    rejection_reason: string(v.rejection_reason),
    expires_at: nullable(v.expires_at),
    created_at: string(v.created_at),
  };
}
function parseHistory(value: unknown): History {
  const v = object(value);
  return {
    id: uuid(v.id),
    actor_id: uuid(v.actor_id),
    from_status: string(v.from_status),
    to_status: string(v.to_status),
    reason: string(v.reason),
    created_at: string(v.created_at),
  };
}
function parseAudit(value: unknown): Audit {
  const v = object(value);
  return {
    id: uuid(v.id),
    actor_id: uuid(v.actor_id),
    action: string(v.action),
    target_type: string(v.target_type),
    target_id: uuid(v.target_id),
    changes: object(v.changes),
    created_at: string(v.created_at),
  };
}
function parseMember(value: unknown): Member {
  const v = object(value);
  return {
    id: uuid(v.id),
    email: string(v.email),
    role_name: string(v.role_name),
    status: choice(v.status, ["invited", "active", "suspended"]),
    joined_at: nullable(v.joined_at),
  };
}
export function pageParser<T>(parse: (value: unknown) => T) {
  return (value: unknown): Page<T> => {
    const v = object(value);
    if (!Array.isArray(v.results) || v.results.length > 25)
      throw new Error("Invalid page");
    return {
      count: integer(v.count),
      next: nullable(v.next),
      previous: nullable(v.previous),
      results: v.results.map(parse),
    };
  };
}
function id(value: string): string {
  if (!isUuid(value)) throw new ApiError("Invalid identifier.", 0);
  return value;
}
export const sellerManagementApi = {
  create: (body: Record<string, string>) =>
    apiRequest("/api/v1/seller/onboarding", {
      method: "POST",
      body,
      expectedStatus: 201,
      parse: parseSeller,
    }),
  detail: (sellerId: string, platform: boolean, signal?: AbortSignal) =>
    apiRequest(
      platform
        ? `/api/v1/admin/sellers/${id(sellerId)}`
        : "/api/v1/seller/settings",
      { sellerId: platform ? undefined : sellerId, parse: parseDetail, signal },
    ),
  update: (sellerId: string, body: Record<string, string>) =>
    apiRequest("/api/v1/seller/settings", {
      sellerId,
      method: "PUT",
      body,
      parse: parseDetail,
    }),
  address: (
    sellerId: string,
    body: Record<string, string>,
    addressId?: string,
  ) =>
    apiRequest(
      `/api/v1/seller/addresses${addressId ? `/${id(addressId)}` : ""}`,
      {
        sellerId,
        method: addressId ? "PUT" : "POST",
        body,
        expectedStatus: addressId ? 200 : 201,
        parse: parseAddress,
      },
    ),
  documents: (
    sellerId: string,
    platform: boolean,
    page: number,
    signal?: AbortSignal,
  ) =>
    apiRequest(
      `${platform ? `/api/v1/admin/sellers/${id(sellerId)}` : "/api/v1/seller"}/documents?page=${page}`,
      {
        sellerId: platform ? undefined : sellerId,
        parse: pageParser(parseDocument),
        signal,
      },
    ),
  upload: (sellerId: string, body: FormData) =>
    apiRequest("/api/v1/seller/documents/upload", {
      sellerId,
      method: "POST",
      body,
      expectedStatus: 201,
      parse: parseDocument,
    }),
  download: (sellerId: string, platform: boolean, documentId: string) =>
    apiRequest(
      `${platform ? `/api/v1/admin/sellers/${id(sellerId)}` : "/api/v1/seller"}/documents/${id(documentId)}/download`,
      {
        sellerId: platform ? undefined : sellerId,
        responseType: "blob",
        parse: (value) => {
          if (!(value instanceof Blob)) throw new Error("Invalid download");
          return value;
        },
      },
    ),
  list: (
    filters: {
      page: number;
      search: string;
      status: string;
      verification_status: string;
    },
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({ page: String(filters.page) });
    for (const key of ["search", "status", "verification_status"] as const)
      if (filters[key]) params.set(key, filters[key]);
    return apiRequest(`/api/v1/admin/sellers?${params}`, {
      parse: pageParser(parseSeller),
      signal,
    });
  },
  action: (
    sellerId: string,
    action: "approve" | "reject" | "suspend" | "reactivate",
    reason: string,
  ) =>
    apiRequest(`/api/v1/admin/sellers/${id(sellerId)}/${action}`, {
      method: "POST",
      body: ["reject", "suspend"].includes(action) ? { reason } : {},
      parse: parseSeller,
    }),
  review: (
    sellerId: string,
    documentId: string,
    approve: boolean,
    reason: string,
  ) =>
    apiRequest(
      `/api/v1/admin/sellers/${id(sellerId)}/documents/${id(documentId)}/${approve ? "approve" : "reject"}`,
      { method: "POST", body: approve ? {} : { reason }, parse: parseDocument },
    ),
  history: (sellerId: string, page: number, signal?: AbortSignal) =>
    apiRequest(`/api/v1/admin/sellers/${id(sellerId)}/history?page=${page}`, {
      parse: pageParser(parseHistory),
      signal,
    }),
  audit: (sellerId: string, page: number, signal?: AbortSignal) =>
    apiRequest(`/api/v1/admin/sellers/${id(sellerId)}/audit?page=${page}`, {
      parse: pageParser(parseAudit),
      signal,
    }),
  members: (sellerId: string, page: number, signal?: AbortSignal) =>
    apiRequest(`/api/v1/admin/sellers/${id(sellerId)}/members?page=${page}`, {
      parse: pageParser(parseMember),
      signal,
    }),
};
