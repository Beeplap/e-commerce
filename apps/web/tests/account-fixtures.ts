import type {
  CustomerAddress,
  CustomerOrderDetail,
  CustomerOrderListItem,
  CustomerProfile,
} from "@/lib/api/types";
import { user } from "./fixtures";
export const accountId = (n: number) =>
  `91000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const accountProfile: CustomerProfile = {
  ...user,
  phone: "+1 555 0100",
  created_at: "2026-09-01T12:00:00Z",
};
export const accountAddress: CustomerAddress = {
  id: accountId(2),
  full_name: "Alex Shopper",
  phone: "+1 555 0100",
  line1: "12 Market Road",
  line2: "Studio 4",
  city: "Portland",
  state: "OR",
  postal_code: "97201",
  country: "US",
  is_default: true,
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
};
export const accountOrder: CustomerOrderDetail = {
  id: accountId(3),
  order_number: "QC-2026-1042",
  created_at: "2026-10-03T10:00:00Z",
  status: "delivered",
  payment_status: "paid",
  fulfillment_status: "fulfilled",
  subtotal: "120.00",
  shipping_total: "5.00",
  discount_total: "10.00",
  grand_total: "115.00",
  currency: "USD",
  shipping_address: { ...accountAddress },
  billing_address: {},
  packages: [
    {
      seller_order_id: accountId(4),
      seller_id: accountId(5),
      seller_name: "Market Studio",
      status: "delivered",
      carrier: "Parcel carrier",
      tracking_number: "TRACK-1042",
      items: [
        {
          id: accountId(6),
          product_id: accountId(7),
          product_title: "Everyday linen",
          variant_id: accountId(8),
          variant_name: "Natural / Medium",
          sku: "LIN-M",
          quantity: 2,
          unit_price: "60.00",
          total_price: "120.00",
          can_review: true,
          can_return: true,
        },
      ],
      tracking_events: [
        {
          id: accountId(9),
          status: "delivered",
          location: "Front door",
          description: "Delivered to recipient",
          timestamp: "2026-10-05T12:00:00Z",
        },
      ],
    },
  ],
};
export const accountListOrder: CustomerOrderListItem = {
  id: accountOrder.id,
  order_number: accountOrder.order_number,
  created_at: accountOrder.created_at,
  status: accountOrder.status,
  payment_status: "paid",
  fulfillment_status: "fulfilled",
  grand_total: "115.00",
  currency: "USD",
  total_items: 2,
  packages_count: 1,
  items_preview: accountOrder.packages[0]!.items.map((item) => ({
    id: item.id,
    product_title: item.product_title,
    variant_name: item.variant_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
  })),
};
