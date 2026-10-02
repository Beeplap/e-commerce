import { apiRequest } from "@/lib/api/client";
import { isUuid, record } from "@/lib/api/validation";
import { pageParser } from "@/features/sellers/api";
import type { Page } from "@/lib/api/types";

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryVariant {
  id: string;
  sku: string;
  barcode: string;
  product_id: string;
  product_name: string;
}

export interface InventoryItem {
  id: string;
  warehouse: Warehouse;
  variant: InventoryVariant;
  quantity_on_hand: number;
  quantity_reserved: number;
  available_quantity: number;
  reorder_level: number;
  is_low_stock: boolean;
  updated_at: string;
}

export const transactionTypes = [
  "purchase",
  "sale",
  "return",
  "adjustment",
  "reservation",
  "release",
] as const;
export type TransactionType = (typeof transactionTypes)[number];

export interface InventoryTransaction {
  id: string;
  inventory_id: string;
  type: TransactionType;
  quantity_delta: number;
  reference_type: string;
  reference_id: string;
  reason: string;
  created_by_id: string | null;
  created_at: string;
}

function object(value: unknown) {
  if (!record(value)) throw new Error("Invalid inventory response");
  return value;
}

function text(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid inventory response");
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
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new Error("Invalid count");
  return value;
}

function parseWarehouse(data: unknown): Warehouse {
  const item = object(data);
  return {
    id: uuid(item.id),
    name: text(item.name),
    code: text(item.code),
    address: text(item.address),
    is_active: bool(item.is_active),
    created_at: text(item.created_at),
    updated_at: text(item.updated_at),
  };
}

function parseVariant(data: unknown): InventoryVariant {
  const item = object(data);
  return {
    id: uuid(item.id),
    sku: text(item.sku),
    barcode: text(item.barcode),
    product_id: uuid(item.product_id),
    product_name: text(item.product_name),
  };
}

function parseInventoryItem(data: unknown): InventoryItem {
  const item = object(data);
  return {
    id: uuid(item.id),
    warehouse: parseWarehouse(item.warehouse),
    variant: parseVariant(item.variant),
    quantity_on_hand: integer(item.quantity_on_hand),
    quantity_reserved: integer(item.quantity_reserved),
    available_quantity: integer(item.available_quantity),
    reorder_level: integer(item.reorder_level),
    is_low_stock: bool(item.is_low_stock),
    updated_at: text(item.updated_at),
  };
}

function parseTransaction(data: unknown): InventoryTransaction {
  const item = object(data);
  const typeStr = text(item.type);
  if (!transactionTypes.includes(typeStr as TransactionType)) {
    throw new Error("Invalid transaction type");
  }
  return {
    id: uuid(item.id),
    inventory_id: uuid(item.inventory_id),
    type: typeStr as TransactionType,
    quantity_delta: integer(item.quantity_delta),
    reference_type: text(item.reference_type),
    reference_id: text(item.reference_id),
    reason: text(item.reason),
    created_by_id:
      item.created_by_id === null ? null : uuid(item.created_by_id),
    created_at: text(item.created_at),
  };
}

export const warehousePageParser = pageParser(parseWarehouse);
export const inventoryPageParser = pageParser(parseInventoryItem);
export const transactionPageParser = pageParser(parseTransaction);

export const inventoryApi = {
  warehouses: (
    sellerId: string,
    filter: { page?: number; is_active?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<Page<Warehouse>> => {
    const params = new URLSearchParams();
    if (filter.page) params.set("page", String(filter.page));
    if (filter.is_active !== undefined)
      params.set("is_active", String(filter.is_active));
    const query = params.toString();
    return apiRequest(`/api/v1/seller/warehouses${query ? `?${query}` : ""}`, {
      sellerId: uuid(sellerId),
      signal,
      parse: warehousePageParser,
    });
  },

  warehouse: (
    sellerId: string,
    warehouseId: string,
    signal?: AbortSignal,
  ): Promise<Warehouse> =>
    apiRequest(`/api/v1/seller/warehouses/${uuid(warehouseId)}`, {
      sellerId: uuid(sellerId),
      signal,
      parse: parseWarehouse,
    }),

  createWarehouse: (
    sellerId: string,
    input: {
      name: string;
      code: string;
      address?: string;
      is_active?: boolean;
    },
  ): Promise<Warehouse> =>
    apiRequest("/api/v1/seller/warehouses", {
      method: "POST",
      sellerId: uuid(sellerId),
      body: input,
      parse: parseWarehouse,
    }),

  updateWarehouse: (
    sellerId: string,
    warehouseId: string,
    input: { name?: string; address?: string; is_active?: boolean },
  ): Promise<Warehouse> =>
    apiRequest(`/api/v1/seller/warehouses/${uuid(warehouseId)}`, {
      method: "PUT",
      sellerId: uuid(sellerId),
      body: input,
      parse: parseWarehouse,
    }),

  inventory: (
    sellerId: string,
    filter: {
      page?: number;
      warehouse_id?: string;
      variant_id?: string;
      search?: string;
      low_stock?: boolean;
    } = {},
    signal?: AbortSignal,
  ): Promise<Page<InventoryItem>> => {
    const params = new URLSearchParams();
    if (filter.page) params.set("page", String(filter.page));
    if (filter.warehouse_id)
      params.set("warehouse_id", uuid(filter.warehouse_id));
    if (filter.variant_id) params.set("variant_id", uuid(filter.variant_id));
    if (filter.search?.trim()) params.set("search", filter.search.trim());
    if (filter.low_stock !== undefined)
      params.set("low_stock", String(filter.low_stock));
    const query = params.toString();
    return apiRequest(`/api/v1/seller/inventory${query ? `?${query}` : ""}`, {
      sellerId: uuid(sellerId),
      signal,
      parse: inventoryPageParser,
    });
  },

  inventoryItem: (
    sellerId: string,
    inventoryId: string,
    signal?: AbortSignal,
  ): Promise<InventoryItem> =>
    apiRequest(`/api/v1/seller/inventory/${uuid(inventoryId)}`, {
      sellerId: uuid(sellerId),
      signal,
      parse: parseInventoryItem,
    }),

  createInventoryItem: (
    sellerId: string,
    input: { warehouse_id: string; variant_id: string; reorder_level?: number },
  ): Promise<InventoryItem> =>
    apiRequest("/api/v1/seller/inventory", {
      method: "POST",
      sellerId: uuid(sellerId),
      body: {
        warehouse_id: uuid(input.warehouse_id),
        variant_id: uuid(input.variant_id),
        reorder_level: input.reorder_level ?? 0,
      },
      parse: parseInventoryItem,
    }),

  adjustInventory: (
    sellerId: string,
    inventoryId: string,
    input: {
      quantity_delta: number;
      reason: string;
      reference_type?: string;
      reference_id?: string;
    },
  ): Promise<InventoryItem> =>
    apiRequest(`/api/v1/seller/inventory/${uuid(inventoryId)}/adjust`, {
      method: "POST",
      sellerId: uuid(sellerId),
      body: input,
      parse: parseInventoryItem,
    }),

  reserveInventory: (
    sellerId: string,
    inventoryId: string,
    input: {
      quantity: number;
      reason?: string;
      reference_type?: string;
      reference_id?: string;
    },
  ): Promise<InventoryItem> =>
    apiRequest(`/api/v1/seller/inventory/${uuid(inventoryId)}/reserve`, {
      method: "POST",
      sellerId: uuid(sellerId),
      body: input,
      parse: parseInventoryItem,
    }),

  releaseInventory: (
    sellerId: string,
    inventoryId: string,
    input: {
      quantity: number;
      reason?: string;
      reference_type?: string;
      reference_id?: string;
    },
  ): Promise<InventoryItem> =>
    apiRequest(`/api/v1/seller/inventory/${uuid(inventoryId)}/release`, {
      method: "POST",
      sellerId: uuid(sellerId),
      body: input,
      parse: parseInventoryItem,
    }),

  transactions: (
    sellerId: string,
    filter: {
      page?: number;
      inventory_id?: string;
      type?: string;
    } = {},
    signal?: AbortSignal,
  ): Promise<Page<InventoryTransaction>> => {
    const params = new URLSearchParams();
    if (filter.page) params.set("page", String(filter.page));
    if (filter.inventory_id)
      params.set("inventory_id", uuid(filter.inventory_id));
    if (filter.type) params.set("type", filter.type);
    const query = params.toString();
    return apiRequest(
      `/api/v1/seller/inventory/transactions${query ? `?${query}` : ""}`,
      {
        sellerId: uuid(sellerId),
        signal,
        parse: transactionPageParser,
      },
    );
  },

  platformInventory: (
    filter: {
      page?: number;
      seller_id?: string;
      warehouse_id?: string;
      search?: string;
      low_stock?: boolean;
    } = {},
    signal?: AbortSignal,
  ): Promise<Page<InventoryItem>> => {
    const params = new URLSearchParams();
    if (filter.page) params.set("page", String(filter.page));
    if (filter.seller_id) params.set("seller_id", uuid(filter.seller_id));
    if (filter.warehouse_id)
      params.set("warehouse_id", uuid(filter.warehouse_id));
    if (filter.search?.trim()) params.set("search", filter.search.trim());
    if (filter.low_stock !== undefined)
      params.set("low_stock", String(filter.low_stock));
    const query = params.toString();
    return apiRequest(`/api/v1/admin/inventory${query ? `?${query}` : ""}`, {
      signal,
      parse: inventoryPageParser,
    });
  },

  platformInventoryItem: (
    inventoryId: string,
    signal?: AbortSignal,
  ): Promise<InventoryItem> =>
    apiRequest(`/api/v1/admin/inventory/${uuid(inventoryId)}`, {
      signal,
      parse: parseInventoryItem,
    }),

  platformTransactions: (
    filter: {
      page?: number;
      seller_id?: string;
      inventory_id?: string;
      type?: string;
    } = {},
    signal?: AbortSignal,
  ): Promise<Page<InventoryTransaction>> => {
    const params = new URLSearchParams();
    if (filter.page) params.set("page", String(filter.page));
    if (filter.seller_id) params.set("seller_id", uuid(filter.seller_id));
    if (filter.inventory_id)
      params.set("inventory_id", uuid(filter.inventory_id));
    if (filter.type) params.set("type", filter.type);
    const query = params.toString();
    return apiRequest(
      `/api/v1/admin/inventory/transactions${query ? `?${query}` : ""}`,
      {
        signal,
        parse: transactionPageParser,
      },
    );
  },
};
