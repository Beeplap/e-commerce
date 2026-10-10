"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { WorkspaceFrame } from "@/features/workspaces/workspace-frame";
import { customerApi } from "@/lib/api/client";
import type { CustomerOrderListItem } from "@/lib/api/types";

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    customerApi
      .getOrders(1, abort.signal)
      .then((data) => {
        setOrders(data.results);
        setError(null);
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Failed to load your orders. Please try again.");
      })
      .finally(() => setLoading(false));

    return () => abort.abort();
  }, []);

  return (
    <WorkspaceFrame mode="account">
      <div className="mb-6">
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
          Order History
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Track packages, view receipts, submit reviews, and manage returns.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">
          Loading your order history...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h2 className="text-base font-bold text-slate-900">No orders yet</h2>
          <p className="mt-1 text-xs text-slate-500">
            When you place orders across marketplace merchants, they will appear
            here.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-900 transition"
            >
              Start Shopping
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4" data-testid="customer-orders-list">
          {orders.map((order) => (
            <div
              key={order.id}
              data-testid={`customer-order-card-${order.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Order Number
                  </span>
                  <p
                    data-testid="customer-order-number"
                    className="font-mono font-bold text-slate-900 text-sm"
                  >
                    {order.order_number}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Placed on {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Total
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      ${order.grand_total} {order.currency}
                    </span>
                  </div>

                  <span
                    data-testid="order-status-badge"
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                      order.status === "cancelled"
                        ? "bg-rose-100 text-rose-800"
                        : order.status === "delivered"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-teal-100 text-teal-800"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Items preview */}
              <div className="py-4 space-y-2">
                {order.items_preview.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs text-slate-600"
                  >
                    <span className="font-medium text-slate-800">
                      {item.product_title}{" "}
                      <span className="text-slate-400 font-normal">
                        ({item.variant_name})
                      </span>
                    </span>
                    <span>
                      Qty: {item.quantity} · ${item.unit_price}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {order.packages_count}{" "}
                  {order.packages_count === 1
                    ? "merchant package"
                    : "merchant packages"}
                </span>
                <Link
                  href={`/account/orders/${order.id}`}
                  data-testid={`view-order-link-${order.id}`}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  View Details & Tracking →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </WorkspaceFrame>
  );
}
