import { apiRequest } from "@/lib/api/client";
import { isUuid, record } from "@/lib/api/validation";
import { pageParser } from "@/features/sellers/api";
import type { Page } from "@/lib/api/types";

export type ShipmentStatus =
  | "pending"
  | "preparing"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "cancelled";

export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "in_transit"
  | "received"
  | "refund_pending"
  | "refunded"
  | "closed";

export type RefundStatus = "pending" | "processing" | "completed" | "failed";

export interface ShipmentItem {
  id: string;
  order_item_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  quantity: number;
  created_at: string;
}

export interface TrackingEvent {
  id: string;
  status: string;
  location: string;
  description: string;
  timestamp: string;
  created_at: string;
}

export interface Shipment {
  id: string;
  shipment_number: string;
  seller_id: string;
  seller_name: string;
  seller_order_id: string;
  seller_order_number: string;
  shipping_method_id: string | null;
  carrier: string;
  tracking_number: string;
  tracking_url: string;
  status: ShipmentStatus;
  shipped_at: string | null;
  delivered_at: string | null;
  estimated_delivery_at: string | null;
  shipping_label_url: string;
  notes: string;
  items: ShipmentItem[];
  tracking_events: TrackingEvent[];
  created_at: string;
  updated_at: string;
}

export interface ReturnItem {
  id: string;
  order_item_id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  quantity: number;
  reason: string;
  condition: string;
  restock_inventory: boolean;
  warehouse_id: string | null;
  refund_amount: string;
}

export interface ReturnStatusHistory {
  id: string;
  actor_id: string | null;
  from_status: string;
  to_status: string;
  notes: string;
  created_at: string;
}

export interface ReturnRequest {
  id: string;
  return_number: string;
  seller_id: string;
  seller_name: string;
  seller_order_id: string;
  seller_order_number: string;
  customer_id: string | null;
  customer_email: string | null;
  status: ReturnStatus;
  reason: string;
  customer_notes: string;
  rejection_reason: string;
  return_tracking_number: string;
  return_carrier: string;
  requested_at: string;
  approved_at: string | null;
  received_at: string | null;
  closed_at: string | null;
  items: ReturnItem[];
  status_history: ReturnStatusHistory[];
  created_at: string;
  updated_at: string;
}

export interface RefundTransaction {
  id: string;
  transaction_type: string;
  amount: string;
  gateway_reference: string;
  status: string;
  raw_response: Record<string, unknown>;
  created_at: string;
}

export interface Refund {
  id: string;
  refund_number: string;
  seller_id: string;
  seller_name: string;
  seller_order_id: string;
  seller_order_number: string;
  return_request_id: string | null;
  amount: string;
  currency: string;
  status: RefundStatus;
  reason: string;
  commission_reversed: string;
  seller_deduction: string;
  created_by_id: string | null;
  transactions: RefundTransaction[];
  created_at: string;
  completed_at: string | null;
}

// -------------------------------------------------------------------------
// Parsers
// -------------------------------------------------------------------------

function object(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new Error("Invalid fulfillment response");
  return value;
}

export function shipmentItemParser(value: unknown): ShipmentItem {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("Invalid shipment item id.");
  return {
    id: String(row.id),
    order_item_id: String(row.order_item_id),
    sku_snapshot: String(row.sku_snapshot ?? ""),
    product_name_snapshot: String(row.product_name_snapshot ?? ""),
    quantity: Number(row.quantity),
    created_at: String(row.created_at ?? ""),
  };
}

export function trackingEventParser(value: unknown): TrackingEvent {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("Invalid tracking event id.");
  return {
    id: String(row.id),
    status: String(row.status),
    location: String(row.location ?? ""),
    description: String(row.description ?? ""),
    timestamp: String(row.timestamp ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export function shipmentParser(value: unknown): Shipment {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("Invalid shipment id.");
  const items = Array.isArray(row.items)
    ? row.items.map(shipmentItemParser)
    : [];
  const events = Array.isArray(row.tracking_events)
    ? row.tracking_events.map(trackingEventParser)
    : [];

  return {
    id: String(row.id),
    shipment_number: String(row.shipment_number),
    seller_id: String(row.seller_id),
    seller_name: String(row.seller_name ?? ""),
    seller_order_id: String(row.seller_order_id),
    seller_order_number: String(row.seller_order_number ?? ""),
    shipping_method_id: row.shipping_method_id
      ? String(row.shipping_method_id)
      : null,
    carrier: String(row.carrier),
    tracking_number: String(row.tracking_number ?? ""),
    tracking_url: String(row.tracking_url ?? ""),
    status: row.status as ShipmentStatus,
    shipped_at: row.shipped_at ? String(row.shipped_at) : null,
    delivered_at: row.delivered_at ? String(row.delivered_at) : null,
    estimated_delivery_at: row.estimated_delivery_at
      ? String(row.estimated_delivery_at)
      : null,
    shipping_label_url: String(row.shipping_label_url ?? ""),
    notes: String(row.notes ?? ""),
    items,
    tracking_events: events,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function returnItemParser(value: unknown): ReturnItem {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("Invalid return item id.");
  return {
    id: String(row.id),
    order_item_id: String(row.order_item_id),
    sku_snapshot: String(row.sku_snapshot ?? ""),
    product_name_snapshot: String(row.product_name_snapshot ?? ""),
    quantity: Number(row.quantity),
    reason: String(row.reason ?? ""),
    condition: String(row.condition ?? ""),
    restock_inventory: Boolean(row.restock_inventory),
    warehouse_id: row.warehouse_id ? String(row.warehouse_id) : null,
    refund_amount: String(row.refund_amount ?? "0.00"),
  };
}

export function returnStatusHistoryParser(value: unknown): ReturnStatusHistory {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("Invalid return history id.");
  return {
    id: String(row.id),
    actor_id: row.actor_id ? String(row.actor_id) : null,
    from_status: String(row.from_status ?? ""),
    to_status: String(row.to_status ?? ""),
    notes: String(row.notes ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export function returnRequestParser(value: unknown): ReturnRequest {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("Invalid return request id.");
  const items = Array.isArray(row.items) ? row.items.map(returnItemParser) : [];
  const history = Array.isArray(row.status_history)
    ? row.status_history.map(returnStatusHistoryParser)
    : [];

  return {
    id: String(row.id),
    return_number: String(row.return_number),
    seller_id: String(row.seller_id),
    seller_name: String(row.seller_name ?? ""),
    seller_order_id: String(row.seller_order_id),
    seller_order_number: String(row.seller_order_number ?? ""),
    customer_id: row.customer_id ? String(row.customer_id) : null,
    customer_email: row.customer_email ? String(row.customer_email) : null,
    status: row.status as ReturnStatus,
    reason: String(row.reason),
    customer_notes: String(row.customer_notes ?? ""),
    rejection_reason: String(row.rejection_reason ?? ""),
    return_tracking_number: String(row.return_tracking_number ?? ""),
    return_carrier: String(row.return_carrier ?? ""),
    requested_at: String(row.requested_at),
    approved_at: row.approved_at ? String(row.approved_at) : null,
    received_at: row.received_at ? String(row.received_at) : null,
    closed_at: row.closed_at ? String(row.closed_at) : null,
    items,
    status_history: history,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function refundTransactionParser(value: unknown): RefundTransaction {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("Invalid refund transaction id.");
  return {
    id: String(row.id),
    transaction_type: String(row.transaction_type),
    amount: String(row.amount),
    gateway_reference: String(row.gateway_reference ?? ""),
    status: String(row.status),
    raw_response: (row.raw_response as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  };
}

export function refundParser(value: unknown): Refund {
  const row = object(value);
  if (!isUuid(row.id)) throw new Error("Invalid refund id.");
  const transactions = Array.isArray(row.transactions)
    ? row.transactions.map(refundTransactionParser)
    : [];

  return {
    id: String(row.id),
    refund_number: String(row.refund_number),
    seller_id: String(row.seller_id),
    seller_name: String(row.seller_name ?? ""),
    seller_order_id: String(row.seller_order_id),
    seller_order_number: String(row.seller_order_number ?? ""),
    return_request_id: row.return_request_id
      ? String(row.return_request_id)
      : null,
    amount: String(row.amount),
    currency: String(row.currency ?? "USD"),
    status: row.status as RefundStatus,
    reason: String(row.reason),
    commission_reversed: String(row.commission_reversed ?? "0.00"),
    seller_deduction: String(row.seller_deduction ?? "0.00"),
    created_by_id: row.created_by_id ? String(row.created_by_id) : null,
    transactions,
    created_at: String(row.created_at),
    completed_at: row.completed_at ? String(row.completed_at) : null,
  };
}

// -------------------------------------------------------------------------
// Seller API Operations
// -------------------------------------------------------------------------

export async function sellerListShipments(
  sellerId: string,
  params?: { page?: number; status?: string; seller_order_id?: string },
  signal?: AbortSignal,
): Promise<Page<Shipment>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.seller_order_id)
    searchParams.set("seller_order_id", params.seller_order_id);
  const q = searchParams.toString();

  return apiRequest(`/api/v1/seller/fulfillment/shipments${q ? `?${q}` : ""}`, {
    sellerId,
    signal,
    parse: pageParser(shipmentParser),
  });
}

export async function sellerCreateShipment(
  sellerId: string,
  payload: {
    seller_order_id: string;
    carrier: string;
    tracking_number?: string;
    tracking_url?: string;
    shipping_method_id?: string;
    items: Array<{ order_item_id: string; quantity: number }>;
    notes?: string;
  },
): Promise<Shipment> {
  return apiRequest("/api/v1/seller/fulfillment/shipments", {
    method: "POST",
    sellerId,
    body: payload,
    expectedStatus: 201,
    parse: shipmentParser,
  });
}

export async function sellerGetShipment(
  sellerId: string,
  shipmentId: string,
): Promise<Shipment> {
  return apiRequest(`/api/v1/seller/fulfillment/shipments/${shipmentId}`, {
    sellerId,
    parse: shipmentParser,
  });
}

export async function sellerAddTrackingEvent(
  sellerId: string,
  shipmentId: string,
  payload: { status: string; location?: string; description?: string },
): Promise<TrackingEvent> {
  return apiRequest(
    `/api/v1/seller/fulfillment/shipments/${shipmentId}/events`,
    {
      method: "POST",
      sellerId,
      body: payload,
      expectedStatus: 201,
      parse: trackingEventParser,
    },
  );
}

export async function sellerDeliverShipment(
  sellerId: string,
  shipmentId: string,
): Promise<Shipment> {
  return apiRequest(
    `/api/v1/seller/fulfillment/shipments/${shipmentId}/deliver`,
    {
      method: "POST",
      sellerId,
      body: {},
      parse: shipmentParser,
    },
  );
}

export async function sellerListReturns(
  sellerId: string,
  params?: { page?: number; status?: string; seller_order_id?: string },
  signal?: AbortSignal,
): Promise<Page<ReturnRequest>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.seller_order_id)
    searchParams.set("seller_order_id", params.seller_order_id);
  const q = searchParams.toString();

  return apiRequest(`/api/v1/seller/fulfillment/returns${q ? `?${q}` : ""}`, {
    sellerId,
    signal,
    parse: pageParser(returnRequestParser),
  });
}

export async function sellerCreateReturn(
  sellerId: string,
  payload: {
    seller_order_id: string;
    reason: string;
    customer_notes?: string;
    items: Array<{ order_item_id: string; quantity: number; reason?: string }>;
  },
): Promise<ReturnRequest> {
  return apiRequest("/api/v1/seller/fulfillment/returns", {
    method: "POST",
    sellerId,
    body: payload,
    expectedStatus: 201,
    parse: returnRequestParser,
  });
}

export async function sellerGetReturn(
  sellerId: string,
  returnId: string,
): Promise<ReturnRequest> {
  return apiRequest(`/api/v1/seller/fulfillment/returns/${returnId}`, {
    sellerId,
    parse: returnRequestParser,
  });
}

export async function sellerApproveReturn(
  sellerId: string,
  returnId: string,
  payload?: { return_carrier?: string; return_tracking_number?: string },
): Promise<ReturnRequest> {
  return apiRequest(`/api/v1/seller/fulfillment/returns/${returnId}/approve`, {
    method: "POST",
    sellerId,
    body: payload ?? {},
    parse: returnRequestParser,
  });
}

export async function sellerRejectReturn(
  sellerId: string,
  returnId: string,
  payload: { reason: string },
): Promise<ReturnRequest> {
  return apiRequest(`/api/v1/seller/fulfillment/returns/${returnId}/reject`, {
    method: "POST",
    sellerId,
    body: payload,
    parse: returnRequestParser,
  });
}

export async function sellerReceiveReturn(
  sellerId: string,
  returnId: string,
  payload?: {
    items?: Array<{
      return_item_id: string;
      condition?: string;
      restock_inventory?: boolean;
      warehouse_id?: string;
    }>;
  },
): Promise<ReturnRequest> {
  return apiRequest(`/api/v1/seller/fulfillment/returns/${returnId}/receive`, {
    method: "POST",
    sellerId,
    body: payload ?? {},
    parse: returnRequestParser,
  });
}

export async function sellerListRefunds(
  sellerId: string,
  params?: { page?: number; status?: string; seller_order_id?: string },
  signal?: AbortSignal,
): Promise<Page<Refund>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.seller_order_id)
    searchParams.set("seller_order_id", params.seller_order_id);
  const q = searchParams.toString();

  return apiRequest(`/api/v1/seller/fulfillment/refunds${q ? `?${q}` : ""}`, {
    sellerId,
    signal,
    parse: pageParser(refundParser),
  });
}

export async function sellerCreateRefund(
  sellerId: string,
  payload: {
    seller_order_id: string;
    amount: string;
    reason: string;
    return_request_id?: string;
  },
): Promise<Refund> {
  return apiRequest("/api/v1/seller/fulfillment/refunds", {
    method: "POST",
    sellerId,
    body: payload,
    expectedStatus: 201,
    parse: refundParser,
  });
}

export async function sellerGetRefund(
  sellerId: string,
  refundId: string,
): Promise<Refund> {
  return apiRequest(`/api/v1/seller/fulfillment/refunds/${refundId}`, {
    sellerId,
    parse: refundParser,
  });
}

// -------------------------------------------------------------------------
// Platform Admin API Operations
// -------------------------------------------------------------------------

export async function adminListShipments(params?: {
  page?: number;
  status?: string;
  seller_id?: string;
}): Promise<Page<Shipment>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.seller_id) searchParams.set("seller_id", params.seller_id);
  const q = searchParams.toString();

  return apiRequest(`/api/v1/admin/fulfillment/shipments${q ? `?${q}` : ""}`, {
    parse: pageParser(shipmentParser),
  });
}

export async function adminGetShipment(shipmentId: string): Promise<Shipment> {
  return apiRequest(`/api/v1/admin/fulfillment/shipments/${shipmentId}`, {
    parse: shipmentParser,
  });
}

export async function adminListReturns(params?: {
  page?: number;
  status?: string;
  seller_id?: string;
}): Promise<Page<ReturnRequest>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.seller_id) searchParams.set("seller_id", params.seller_id);
  const q = searchParams.toString();

  return apiRequest(`/api/v1/admin/fulfillment/returns${q ? `?${q}` : ""}`, {
    parse: pageParser(returnRequestParser),
  });
}

export async function adminGetReturn(returnId: string): Promise<ReturnRequest> {
  return apiRequest(`/api/v1/admin/fulfillment/returns/${returnId}`, {
    parse: returnRequestParser,
  });
}

export async function adminListRefunds(params?: {
  page?: number;
  status?: string;
  seller_id?: string;
}): Promise<Page<Refund>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.seller_id) searchParams.set("seller_id", params.seller_id);
  const q = searchParams.toString();

  return apiRequest(`/api/v1/admin/fulfillment/refunds${q ? `?${q}` : ""}`, {
    parse: pageParser(refundParser),
  });
}

export async function adminCreateRefund(payload: {
  seller_order_id: string;
  amount: string;
  reason: string;
  return_request_id?: string;
}): Promise<Refund> {
  return apiRequest("/api/v1/admin/fulfillment/refunds", {
    method: "POST",
    body: payload,
    expectedStatus: 201,
    parse: refundParser,
  });
}

export async function adminGetRefund(refundId: string): Promise<Refund> {
  return apiRequest(`/api/v1/admin/fulfillment/refunds/${refundId}`, {
    parse: refundParser,
  });
}
