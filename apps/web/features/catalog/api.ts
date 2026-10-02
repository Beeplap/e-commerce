import { apiRequest, ApiError } from "@/lib/api/client";
import { isUuid, record } from "@/lib/api/validation";
import { pageParser } from "@/features/sellers/api";

export const productStatuses = [
  "draft",
  "pending_review",
  "active",
  "rejected",
  "archived",
] as const;
export type ProductStatus = (typeof productStatuses)[number];
export type Kind =
  "categories" | "brands" | "attributes" | "options" | "category-attributes";
export interface Brand {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}
export interface Category extends Brand {
  parent_id: string | null;
  description: string;
  sort_order: number;
}
export interface Attribute {
  id: string;
  name: string;
  code: string;
  value_type: "text" | "number" | "choice" | "boolean";
  scope: "product" | "variant";
  is_active: boolean;
}
export interface Option {
  id: string;
  name: string;
  attribute_id: string;
  value: string;
  is_active: boolean;
}
export interface CategoryLink {
  id: string;
  name: string;
  category_id: string;
  attribute: Attribute;
  is_required: boolean;
}
export type CatalogRecord =
  Category | Brand | Attribute | Option | CategoryLink;
export interface Product {
  id: string;
  seller_id: string;
  category: Category;
  brand: Brand | null;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  status: ProductStatus;
  currency: string;
  created_by_id: string;
  approved_by_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface Variant {
  id: string;
  product_id: string;
  sku: string;
  barcode: string;
  price: string;
  compare_at_price: string | null;
  cost_price: string | null;
  weight: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  status: "active" | "inactive";
}
export interface AttributeValue {
  id: string;
  attribute: Attribute;
  option: Option | null;
  value: string;
}
export interface ProductImage {
  id: string;
  product_id: string;
  content_type: "image/png" | "image/jpeg";
  size: number;
  alt_text: string;
  sort_order: number;
  created_at: string;
}
export interface History {
  id: string;
  actor_id: string;
  from_status: ProductStatus | "";
  to_status: ProductStatus;
  reason: string;
  created_at: string;
}

function object(value: unknown) {
  if (!record(value)) throw new Error("Invalid catalog response");
  return value;
}
function text(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid catalog response");
  return value;
}
function uuid(value: unknown) {
  if (!isUuid(value)) throw new Error("Invalid identifier");
  return value;
}
function bool(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Invalid flag");
  return value;
}
function integer(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid count");
  return value;
}
function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value === null ? null : parse(value);
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new Error("Invalid catalog choice");
  return value as T;
}
function decimal(value: unknown, places: number): string {
  const result = text(value);
  if (!new RegExp(`^\\d{1,12}\\.\\d{${places}}$`).test(result))
    throw new Error("Invalid decimal");
  return result;
}
function date(value: unknown): string {
  const result = text(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(result) ||
    !Number.isFinite(Date.parse(result))
  )
    throw new Error("Invalid date");
  return result;
}
export function parseBrand(value: unknown): Brand {
  const v = object(value);
  return {
    id: uuid(v.id),
    name: text(v.name),
    slug: text(v.slug),
    is_active: bool(v.is_active),
  };
}
export function parseCategory(value: unknown): Category {
  const v = object(value);
  return {
    ...parseBrand(value),
    parent_id: nullable(v.parent_id, uuid),
    description: text(v.description),
    sort_order: integer(v.sort_order),
  };
}
export function parseAttribute(value: unknown): Attribute {
  const v = object(value);
  return {
    id: uuid(v.id),
    name: text(v.name),
    code: text(v.code),
    value_type: choice(v.value_type, ["text", "number", "choice", "boolean"]),
    scope: choice(v.scope, ["product", "variant"]),
    is_active: bool(v.is_active),
  };
}
export function parseOption(value: unknown): Option {
  const v = object(value);
  return {
    id: uuid(v.id),
    attribute_id: uuid(v.attribute_id),
    name: text(v.name),
    value: text(v.value),
    is_active: bool(v.is_active),
  };
}
export function parseLink(value: unknown): CategoryLink {
  const v = object(value),
    attribute = parseAttribute(v.attribute);
  return {
    id: uuid(v.id),
    name: attribute.name,
    category_id: uuid(v.category_id),
    attribute,
    is_required: bool(v.is_required),
  };
}
const parsers: Record<Kind, (value: unknown) => CatalogRecord> = {
  categories: parseCategory,
  brands: parseBrand,
  attributes: parseAttribute,
  options: parseOption,
  "category-attributes": parseLink,
};
export function parseProduct(value: unknown): Product {
  const v = object(value),
    currency = text(v.currency);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid currency");
  return {
    id: uuid(v.id),
    seller_id: uuid(v.seller_id),
    category: parseCategory(v.category),
    brand: nullable(v.brand, parseBrand),
    name: text(v.name),
    slug: text(v.slug),
    description: text(v.description),
    short_description: text(v.short_description),
    status: choice(v.status, productStatuses),
    currency,
    created_by_id: uuid(v.created_by_id),
    approved_by_id: nullable(v.approved_by_id, uuid),
    approved_at: nullable(v.approved_at, date),
    created_at: date(v.created_at),
    updated_at: date(v.updated_at),
  };
}
export function parseVariant(value: unknown): Variant {
  const v = object(value);
  return {
    id: uuid(v.id),
    product_id: uuid(v.product_id),
    sku: text(v.sku),
    barcode: text(v.barcode),
    price: decimal(v.price, 2),
    compare_at_price: nullable(v.compare_at_price, (x) => decimal(x, 2)),
    cost_price: nullable(v.cost_price, (x) => decimal(x, 2)),
    weight: nullable(v.weight, (x) => decimal(x, 3)),
    length: nullable(v.length, (x) => decimal(x, 3)),
    width: nullable(v.width, (x) => decimal(x, 3)),
    height: nullable(v.height, (x) => decimal(x, 3)),
    status: choice(v.status, ["active", "inactive"]),
  };
}
export function parseValue(value: unknown): AttributeValue {
  const v = object(value);
  return {
    id: uuid(v.id),
    attribute: parseAttribute(v.attribute),
    option: nullable(v.option, parseOption),
    value: text(v.value),
  };
}
export function parseImage(value: unknown): ProductImage {
  const v = object(value);
  return {
    id: uuid(v.id),
    product_id: uuid(v.product_id),
    content_type: choice(v.content_type, ["image/png", "image/jpeg"]),
    size: integer(v.size),
    alt_text: text(v.alt_text),
    sort_order: integer(v.sort_order),
    created_at: date(v.created_at),
  };
}
export function parseHistory(value: unknown): History {
  const v = object(value);
  return {
    id: uuid(v.id),
    actor_id: uuid(v.actor_id),
    from_status: choice(v.from_status, ["", ...productStatuses]),
    to_status: choice(v.to_status, productStatuses),
    reason: text(v.reason),
    created_at: date(v.created_at),
  };
}

export type Context = { sellerId: string } | { platform: true };
function id(value: string) {
  if (!isUuid(value)) throw new ApiError("Invalid identifier.", 0);
  return value;
}
function scope(context: Context) {
  return "sellerId" in context ? { sellerId: context.sellerId } : {};
}
function area(context: Context) {
  return "sellerId" in context ? "seller" : "admin";
}
function query(filters: Record<string, string | number>) {
  return new URLSearchParams(
    Object.entries(filters).map(([key, value]) => [key, String(value)]),
  ).toString();
}
function productRoot(context: Context, productId?: string) {
  return `/api/v1/${area(context)}/products${productId ? `/${id(productId)}` : ""}`;
}
function valuePath(context: Context, productId: string, variantId?: string) {
  return (
    productRoot(context, productId) +
    (variantId ? `/variants/${id(variantId)}` : "") +
    "/attributes"
  );
}
export const catalogApi = {
  taxonomy: (
    context: Context,
    kind: Kind,
    filters: Record<string, string | number>,
    signal?: AbortSignal,
  ) =>
    apiRequest(`/api/v1/${area(context)}/catalog/${kind}?${query(filters)}`, {
      ...scope(context),
      signal,
      parse: pageParser(parsers[kind]),
    }),
  saveTaxonomy: (
    kind: Kind,
    body: Record<string, unknown>,
    identity?: string,
  ) =>
    apiRequest(
      `/api/v1/admin/catalog/${kind}${identity ? `/${id(identity)}` : ""}`,
      {
        method: identity ? "PUT" : "POST",
        body,
        expectedStatus: identity ? 200 : 201,
        parse: parsers[kind],
      },
    ),
  products: (
    context: Context,
    filters: Record<string, string | number>,
    signal?: AbortSignal,
  ) =>
    apiRequest(`${productRoot(context)}?${query(filters)}`, {
      ...scope(context),
      signal,
      parse: pageParser(parseProduct),
    }),
  product: (context: Context, productId: string, signal?: AbortSignal) =>
    apiRequest(productRoot(context, productId), {
      ...scope(context),
      signal,
      parse: parseProduct,
    }),
  saveProduct: (
    sellerId: string,
    body: Record<string, unknown>,
    productId?: string,
  ) =>
    apiRequest(productRoot({ sellerId }, productId), {
      sellerId,
      method: productId ? "PUT" : "POST",
      expectedStatus: productId ? 200 : 201,
      body,
      parse: parseProduct,
    }),
  action: (
    context: Context,
    productId: string,
    action: "archive" | "revise" | "submit-for-review" | "approve" | "reject",
    reason?: string,
  ) =>
    apiRequest(`${productRoot(context, productId)}/${action}`, {
      ...scope(context),
      method: "POST",
      body: action === "reject" ? { reason } : {},
      parse: parseProduct,
    }),
  variants: (
    context: Context,
    productId: string,
    page: number,
    signal?: AbortSignal,
  ) =>
    apiRequest(`${productRoot(context, productId)}/variants?page=${page}`, {
      ...scope(context),
      signal,
      parse: pageParser(parseVariant),
    }),
  saveVariant: (
    sellerId: string,
    productId: string,
    body: Record<string, unknown>,
    variantId?: string,
  ) =>
    apiRequest(
      `${productRoot({ sellerId }, productId)}/variants${variantId ? `/${id(variantId)}` : ""}`,
      {
        sellerId,
        method: variantId ? "PUT" : "POST",
        expectedStatus: variantId ? 200 : 201,
        body,
        parse: parseVariant,
      },
    ),
  values: (
    context: Context,
    productId: string,
    page: number,
    variantId?: string,
    signal?: AbortSignal,
  ) =>
    apiRequest(`${valuePath(context, productId, variantId)}?page=${page}`, {
      ...scope(context),
      signal,
      parse: pageParser(parseValue),
    }),
  saveValue: (
    sellerId: string,
    productId: string,
    body: Record<string, unknown>,
    variantId?: string,
  ) =>
    apiRequest(valuePath({ sellerId }, productId, variantId), {
      sellerId,
      method: "PUT",
      body,
      parse: parseValue,
    }),
  removeValue: (
    sellerId: string,
    productId: string,
    valueId: string,
    variantId?: string,
  ) =>
    apiRequest(
      `${valuePath({ sellerId }, productId, variantId)}/${id(valueId)}`,
      {
        sellerId,
        method: "DELETE",
        body: {},
        expectedStatus: 204,
        parse: () => undefined,
      },
    ),
  images: (
    context: Context,
    productId: string,
    page: number,
    signal?: AbortSignal,
  ) =>
    apiRequest(`${productRoot(context, productId)}/images?page=${page}`, {
      ...scope(context),
      signal,
      parse: pageParser(parseImage),
    }),
  upload: (sellerId: string, productId: string, body: FormData) =>
    apiRequest(`${productRoot({ sellerId }, productId)}/images/upload`, {
      sellerId,
      method: "POST",
      body,
      expectedStatus: 201,
      parse: parseImage,
    }),
  removeImage: (sellerId: string, productId: string, imageId: string) =>
    apiRequest(
      `${productRoot({ sellerId }, productId)}/images/${id(imageId)}`,
      {
        sellerId,
        method: "DELETE",
        body: {},
        expectedStatus: 204,
        parse: () => undefined,
      },
    ),
  download: (context: Context, productId: string, imageId: string) =>
    apiRequest(
      `${productRoot(context, productId)}/images/${id(imageId)}/download`,
      {
        ...scope(context),
        responseType: "blob",
        parse: (value) => {
          if (!(value instanceof Blob)) throw new Error("Invalid file");
          return value;
        },
      },
    ),
  history: (
    context: Context,
    productId: string,
    page: number,
    signal?: AbortSignal,
  ) =>
    apiRequest(`${productRoot(context, productId)}/history?page=${page}`, {
      ...scope(context),
      signal,
      parse: pageParser(parseHistory),
    }),
};
