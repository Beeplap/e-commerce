"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ForbiddenScreen } from "@/features/workspaces/forbidden-screen";
import { hasPlatformPermission } from "@/lib/permissions";
import { useApiQuery } from "@/lib/api/use-api-query";
import { Money, DateDisplay } from "@/components/ui/displays";
import {
  ApiErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  getPlatformOrder,
  type PlatformSellerOrderSummary,
  type OrderItem,
} from "./api";

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminOrderDetailView({ orderId }: { orderId: string }) {
  const { state } = useAuth();
  const user = state.kind === "authenticated" ? state.user : null;

  if (!hasPlatformPermission(user, "platform.orders.read")) {
    return <ForbiddenScreen />;
  }

  return <AdminOrderDetailContent key={orderId} orderId={orderId} />;
}

function AdminOrderDetailContent({ orderId }: { orderId: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getPlatformOrder(orderId, signal),
    [orderId],
  );
  const query = useApiQuery(`admin:order:${orderId}`, load);

  if (query.kind === "loading")
    return <LoadingState label="Loading order details…" />;
  if (query.kind === "error")
    return <ApiErrorState error={query.error} onRetry={query.retry} />;

  const order = query.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/orders"
          className="text-sm font-semibold text-teal-800 hover:underline"
        >
          &larr; Back to platform orders
        </Link>
      </div>

      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Customer: ${order.customer_email} • Currency: ${order.currency}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.payment_status} />
            <StatusBadge status={order.fulfillment_status} />
          </div>
        }
      />

      {/* Overview Totals & Addresses */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Grand Financial Totals">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <Money amount={order.subtotal} currency={order.currency} />
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discounts:</span>
              <span>
                -
                <Money
                  amount={order.discount_total}
                  currency={order.currency}
                />
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax Total:</span>
              <Money amount={order.tax_total} currency={order.currency} />
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Shipping Total:</span>
              <Money amount={order.shipping_total} currency={order.currency} />
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3 font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="text-teal-800">
                <Money amount={order.grand_total} currency={order.currency} />
              </span>
            </div>
          </div>
        </Card>

        <Card title="Shipping Address">
          {Object.keys(order.shipping_address_snapshot).length === 0 ? (
            <p className="text-sm text-slate-500">
              No shipping address recorded.
            </p>
          ) : (
            <pre className="font-sans text-xs whitespace-pre-wrap text-slate-700">
              {JSON.stringify(order.shipping_address_snapshot, null, 2)}
            </pre>
          )}
        </Card>

        <Card title="Billing Address">
          {Object.keys(order.billing_address_snapshot).length === 0 ? (
            <p className="text-sm text-slate-500">
              No billing address recorded.
            </p>
          ) : (
            <pre className="font-sans text-xs whitespace-pre-wrap text-slate-700">
              {JSON.stringify(order.billing_address_snapshot, null, 2)}
            </pre>
          )}
        </Card>
      </div>

      {/* Child Seller Orders */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-900">
          Seller Orders Breakdown
        </h2>

        {order.seller_orders.map((so: PlatformSellerOrderSummary) => (
          <Card
            key={so.id}
            title={`${so.seller_name} (${so.seller_order_number})`}
            action={<StatusBadge status={so.status} />}
          >
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Unit Price</th>
                      <th className="px-3 py-2">Tax</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Commission</th>
                      <th className="px-3 py-2">Seller Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {so.items.map((item: OrderItem) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">
                            {item.product_name_snapshot}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.sku_snapshot}
                          </div>
                        </td>
                        <td className="px-3 py-2">{item.quantity}</td>
                        <td className="px-3 py-2">
                          <Money
                            amount={item.unit_price}
                            currency={order.currency}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Money
                            amount={item.tax_amount}
                            currency={order.currency}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          <Money
                            amount={item.total}
                            currency={order.currency}
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          <Money
                            amount={item.commission_amount}
                            currency={order.currency}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-teal-800">
                          <Money
                            amount={item.seller_net_amount}
                            currency={order.currency}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Status History */}
              <div className="border-t border-slate-100 pt-3">
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Timeline
                </h4>
                <div className="flex flex-wrap gap-3">
                  {so.status_history.map((h) => (
                    <div
                      key={h.id}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                    >
                      <span className="font-semibold">
                        {h.to_status.toUpperCase()}
                      </span>
                      <span className="ml-2 text-slate-400">
                        <DateDisplay value={h.created_at} />
                      </span>
                      {h.notes && (
                        <p className="mt-0.5 text-slate-600">{h.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
