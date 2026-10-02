import { apiRequest } from "@/lib/api/client";
import { isUuid, record } from "@/lib/api/validation";
import { pageParser } from "@/features/sellers/api";
import type { Page } from "@/lib/api/types";

export type SellerOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderPaymentStatus =
  "pending" | "authorized" | "paid" | "failed" | "refunded";

export type OrderFulfillmentStatus =
  "unfulfilled" | "partially_fulfilled" | "fulfilled" | "cancelled";

export interface OrderItem {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string | null;
  product_name_snapshot: string;
  sku_snapshot: string;
  variant_snapshot: Record<string, unknown>;
  quantity: number;
  unit_price: string;
  discount_amount: string;
  tax_amount: string;
  total: string;
  commission_amount: string;
  seller_net_amount: string;
}

export interface OrderStatusHistory {
  id: string;
  actor_id: string | null;
  from_status: string;
  to_status: string;
  notes: string;
  created_at: string;
}

export interface SellerOrderSummary {
  id: string;
  order_id: string;
  order_number: string;
  seller_order_number: string;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  shipping_total: string;
  commission_total: string;
  seller_net_total: string;
  status: SellerOrderStatus;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface SellerOrderDetail extends SellerOrderSummary {
  customer_email: string;
  shipping_address_snapshot: Record<string, unknown>;
  billing_address_snapshot: Record<string, unknown>;
  items: OrderItem[];
  status_history: OrderStatusHistory[];
}

export interface PlatformSellerOrderSummary {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_order_number: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  shipping_total: string;
  commission_total: string;
  seller_net_total: string;
  status: SellerOrderStatus;
  items: OrderItem[];
  status_history: OrderStatusHistory[];
  created_at: string;
  updated_at: string;
}

export interface PlatformOrderSummary {
  id: string;
  order_number: string;
  customer_email: string;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  shipping_total: string;
  grand_total: string;
  payment_status: OrderPaymentStatus;
  fulfillment_status: OrderFulfillmentStatus;
  seller_orders_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformOrderDetail extends PlatformOrderSummary {
  customer_id: string | null;
  billing_address_snapshot: Record<string, unknown>;
  shipping_address_snapshot: Record<string, unknown>;
  seller_orders: PlatformSellerOrderSummary[];
}

function object(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new Error("Invalid order response");
  return value;
}

export function parseOrderItem(data: unknown): OrderItem {
  const row = object(data);
  if (!isUuid(row.id)) throw new Error("Invalid order item id");

  return {
    id: row.id,
    product_id: typeof row.product_id === "string" ? row.product_id : null,
    variant_id: typeof row.variant_id === "string" ? row.variant_id : null,
    warehouse_id:
      typeof row.warehouse_id === "string" ? row.warehouse_id : null,
    product_name_snapshot: String(row.product_name_snapshot ?? ""),
    sku_snapshot: String(row.sku_snapshot ?? ""),
    variant_snapshot:
      typeof row.variant_snapshot === "object" && row.variant_snapshot !== null
        ? (row.variant_snapshot as Record<string, unknown>)
        : {},
    quantity:
      typeof row.quantity === "number" ? row.quantity : Number(row.quantity),
    unit_price: String(row.unit_price ?? "0.00"),
    discount_amount: String(row.discount_amount ?? "0.00"),
    tax_amount: String(row.tax_amount ?? "0.00"),
    total: String(row.total ?? "0.00"),
    commission_amount: String(row.commission_amount ?? "0.00"),
    seller_net_amount: String(row.seller_net_amount ?? "0.00"),
  };
}

export function parseOrderStatusHistory(data: unknown): OrderStatusHistory {
  const row = object(data);
  if (!isUuid(row.id)) throw new Error("Invalid status history id");

  return {
    id: row.id,
    actor_id: typeof row.actor_id === "string" ? row.actor_id : null,
    from_status: String(row.from_status ?? ""),
    to_status: String(row.to_status ?? ""),
    notes: String(row.notes ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export function parseSellerOrderSummary(data: unknown): SellerOrderSummary {
  const row = object(data);
  if (!isUuid(row.id)) throw new Error("Invalid seller order id");

  return {
    id: row.id,
    order_id: String(row.order_id ?? ""),
    order_number: String(row.order_number ?? ""),
    seller_order_number: String(row.seller_order_number ?? ""),
    currency: String(row.currency ?? ""),
    subtotal: String(row.subtotal ?? "0.00"),
    discount_total: String(row.discount_total ?? "0.00"),
    tax_total: String(row.tax_total ?? "0.00"),
    shipping_total: String(row.shipping_total ?? "0.00"),
    commission_total: String(row.commission_total ?? "0.00"),
    seller_net_total: String(row.seller_net_total ?? "0.00"),
    status: row.status as SellerOrderStatus,
    items_count:
      typeof row.items_count === "number"
        ? row.items_count
        : Number(row.items_count ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function parseSellerOrderDetail(data: unknown): SellerOrderDetail {
  const base = parseSellerOrderSummary(data);
  const row = object(data);

  const items = Array.isArray(row.items) ? row.items.map(parseOrderItem) : [];
  const status_history = Array.isArray(row.status_history)
    ? row.status_history.map(parseOrderStatusHistory)
    : [];

  return {
    ...base,
    customer_email: String(row.customer_email ?? ""),
    shipping_address_snapshot:
      typeof row.shipping_address_snapshot === "object" &&
      row.shipping_address_snapshot !== null
        ? (row.shipping_address_snapshot as Record<string, unknown>)
        : {},
    billing_address_snapshot:
      typeof row.billing_address_snapshot === "object" &&
      row.billing_address_snapshot !== null
        ? (row.billing_address_snapshot as Record<string, unknown>)
        : {},
    items,
    status_history,
  };
}

export function parsePlatformSellerOrderSummary(
  data: unknown,
): PlatformSellerOrderSummary {
  const row = object(data);
  if (!isUuid(row.id)) throw new Error("Invalid seller order id");

  return {
    id: row.id,
    seller_id: String(row.seller_id ?? ""),
    seller_name: String(row.seller_name ?? ""),
    seller_order_number: String(row.seller_order_number ?? ""),
    subtotal: String(row.subtotal ?? "0.00"),
    discount_total: String(row.discount_total ?? "0.00"),
    tax_total: String(row.tax_total ?? "0.00"),
    shipping_total: String(row.shipping_total ?? "0.00"),
    commission_total: String(row.commission_total ?? "0.00"),
    seller_net_total: String(row.seller_net_total ?? "0.00"),
    status: row.status as SellerOrderStatus,
    items: Array.isArray(row.items) ? row.items.map(parseOrderItem) : [],
    status_history: Array.isArray(row.status_history)
      ? row.status_history.map(parseOrderStatusHistory)
      : [],
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function parsePlatformOrderSummary(data: unknown): PlatformOrderSummary {
  const row = object(data);
  if (!isUuid(row.id)) throw new Error("Invalid order id");

  return {
    id: row.id,
    order_number: String(row.order_number ?? ""),
    customer_email: String(row.customer_email ?? ""),
    currency: String(row.currency ?? ""),
    subtotal: String(row.subtotal ?? "0.00"),
    discount_total: String(row.discount_total ?? "0.00"),
    tax_total: String(row.tax_total ?? "0.00"),
    shipping_total: String(row.shipping_total ?? "0.00"),
    grand_total: String(row.grand_total ?? "0.00"),
    payment_status: row.payment_status as OrderPaymentStatus,
    fulfillment_status: row.fulfillment_status as OrderFulfillmentStatus,
    seller_orders_count:
      typeof row.seller_orders_count === "number"
        ? row.seller_orders_count
        : Number(row.seller_orders_count ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function parsePlatformOrderDetail(data: unknown): PlatformOrderDetail {
  const base = parsePlatformOrderSummary(data);
  const row = object(data);

  const seller_orders = Array.isArray(row.seller_orders)
    ? row.seller_orders.map(parsePlatformSellerOrderSummary)
    : [];

  return {
    ...base,
    customer_id: typeof row.customer_id === "string" ? row.customer_id : null,
    billing_address_snapshot:
      typeof row.billing_address_snapshot === "object" &&
      row.billing_address_snapshot !== null
        ? (row.billing_address_snapshot as Record<string, unknown>)
        : {},
    shipping_address_snapshot:
      typeof row.shipping_address_snapshot === "object" &&
      row.shipping_address_snapshot !== null
        ? (row.shipping_address_snapshot as Record<string, unknown>)
        : {},
    seller_orders,
  };
}

// Seller API functions
export async function listSellerOrders(
  sellerId: string,
  params: {
    page?: number;
    status?: string;
    search?: string;
  } = {},
  signal?: AbortSignal,
): Promise<Page<SellerOrderSummary>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);

  const qs = query.toString();
  return apiRequest(`/api/v1/seller/orders/${qs ? `?${qs}` : ""}`, {
    method: "GET",
    sellerId,
    signal,
    parse: pageParser(parseSellerOrderSummary),
  });
}

export async function getSellerOrder(
  sellerId: string,
  orderId: string,
  signal?: AbortSignal,
): Promise<SellerOrderDetail> {
  return apiRequest(`/api/v1/seller/orders/${orderId}/`, {
    method: "GET",
    sellerId,
    signal,
    parse: parseSellerOrderDetail,
  });
}

export async function confirmSellerOrder(
  sellerId: string,
  orderId: string,
): Promise<SellerOrderDetail> {
  return apiRequest(`/api/v1/seller/orders/${orderId}/confirm/`, {
    method: "POST",
    sellerId,
    parse: parseSellerOrderDetail,
  });
}

export async function beginProcessingSellerOrder(
  sellerId: string,
  orderId: string,
): Promise<SellerOrderDetail> {
  return apiRequest(`/api/v1/seller/orders/${orderId}/begin-processing/`, {
    method: "POST",
    sellerId,
    parse: parseSellerOrderDetail,
  });
}

export async function shipSellerOrder(
  sellerId: string,
  orderId: string,
  data: { carrier?: string; tracking_number?: string } = {},
): Promise<SellerOrderDetail> {
  return apiRequest(`/api/v1/seller/orders/${orderId}/ship/`, {
    method: "POST",
    sellerId,
    body: data,
    parse: parseSellerOrderDetail,
  });
}

export async function deliverSellerOrder(
  sellerId: string,
  orderId: string,
): Promise<SellerOrderDetail> {
  return apiRequest(`/api/v1/seller/orders/${orderId}/deliver/`, {
    method: "POST",
    sellerId,
    parse: parseSellerOrderDetail,
  });
}

export async function cancelSellerOrder(
  sellerId: string,
  orderId: string,
  reason: string,
): Promise<SellerOrderDetail> {
  return apiRequest(`/api/v1/seller/orders/${orderId}/cancel/`, {
    method: "POST",
    sellerId,
    body: { reason },
    parse: parseSellerOrderDetail,
  });
}

// Platform API functions
export async function listPlatformOrders(
  params: {
    page?: number;
    payment_status?: string;
    fulfillment_status?: string;
    search?: string;
  } = {},
  signal?: AbortSignal,
): Promise<Page<PlatformOrderSummary>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.payment_status) query.set("payment_status", params.payment_status);
  if (params.fulfillment_status)
    query.set("fulfillment_status", params.fulfillment_status);
  if (params.search) query.set("search", params.search);

  const qs = query.toString();
  return apiRequest(`/api/v1/admin/orders/${qs ? `?${qs}` : ""}`, {
    method: "GET",
    signal,
    parse: pageParser(parsePlatformOrderSummary),
  });
}

export async function getPlatformOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<PlatformOrderDetail> {
  return apiRequest(`/api/v1/admin/orders/${orderId}/`, {
    method: "GET",
    signal,
    parse: parsePlatformOrderDetail,
  });
}
