"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { StorefrontButton } from "@/components/storefront/controls";
import { DateDisplay, Money } from "@/components/ui/displays";
import { customerApi } from "@/lib/api/client";
import { useApiQuery } from "@/lib/api/use-api-query";
import { ordersEvidence } from "./evidence";
import { AccountFrame } from "./frame";
import { AccountError, AccountLoading, AccountStatus } from "./shared";

export function CustomerOrdersPage() {
  return (
    <AccountFrame
      title="Order History"
      description="Order details, seller packages, tracking and post-purchase actions."
    >
      {(user) => <OrderHistory userId={user.id} />}
    </AccountFrame>
  );
}
function OrderHistory({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const load = useCallback(
    async (signal: AbortSignal) =>
      ordersEvidence(await customerApi.getOrders(page, signal)),
    [page],
  );
  const query = useApiQuery(`${userId}:orders:${page}`, load);
  return (
    <>
      {query.kind === "loading" && (
        <AccountLoading label="Loading your order history" />
      )}
      {query.kind === "error" && (
        <AccountError error={query.error} onRetry={query.retry} />
      )}
      {query.kind === "ready" &&
        (!query.data.results.length ? (
          <div className="sf-account-empty">
            <h2>{page === 1 ? "No orders yet" : "No orders on this page"}</h2>
            <p>
              {page === 1
                ? "Your purchases will appear here after you place an order."
                : "Return to the previous page to view your purchases."}
            </p>
            {page === 1 ? (
              <Link href="/shop" className="sf-button" data-variant="primary">
                Start Shopping
              </Link>
            ) : (
              <StorefrontButton
                variant="secondary"
                onClick={() => setPage(page - 1)}
              >
                Previous page
              </StorefrontButton>
            )}
          </div>
        ) : (
          <>
            <p className="sf-account-result-count">
              {query.data.count} {query.data.count === 1 ? "order" : "orders"} ·
              Page {page}
            </p>
            <ul
              className="sf-account-orders"
              data-testid="customer-orders-list"
            >
              {query.data.results.map((order) => (
                <li
                  key={order.id}
                  data-testid={`customer-order-card-${order.id}`}
                >
                  <div className="sf-account-order-header">
                    <div>
                      <Link
                        href={`/account/orders/${order.id}`}
                        data-testid="customer-order-number"
                        className="sf-account-order-number"
                      >
                        {order.order_number}
                      </Link>
                      <p>
                        Placed <DateDisplay value={order.created_at} />
                      </p>
                    </div>
                    <div className="sf-account-order-total">
                      <Money
                        amount={order.grand_total}
                        currency={order.currency}
                      />
                      <AccountStatus
                        status={order.status}
                        testId="order-status-badge"
                      />
                    </div>
                  </div>
                  <ul className="sf-account-item-preview">
                    {order.items_preview.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.product_title}</strong>
                          <small>{item.variant_name}</small>
                        </div>
                        <div>
                          <small>Qty: {item.quantity}</small>
                          <Money
                            amount={item.unit_price}
                            currency={order.currency}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="sf-account-order-footer">
                    <span>
                      {order.packages_count}{" "}
                      {order.packages_count === 1
                        ? "seller package"
                        : "seller packages"}
                    </span>
                    <Link
                      href={`/account/orders/${order.id}`}
                      data-testid={`view-order-link-${order.id}`}
                      className="sf-button"
                      data-variant="secondary"
                    >
                      View details & tracking
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <nav className="sf-account-pagination" aria-label="Order pages">
              <StorefrontButton
                variant="secondary"
                disabled={!query.data.previous || page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous page
              </StorefrontButton>
              <span>Page {page}</span>
              <StorefrontButton
                variant="secondary"
                disabled={!query.data.next || page >= 10000}
                onClick={() => setPage(page + 1)}
              >
                Next page
              </StorefrontButton>
            </nav>
          </>
        ))}
    </>
  );
}
