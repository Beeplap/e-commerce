"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import {
  StorefrontButton,
  StorefrontInput,
} from "@/components/storefront/controls";
import {
  StorefrontNotice,
  StorefrontOverlay,
} from "@/components/storefront/feedback";
import { DateDisplay, Money } from "@/components/ui/displays";
import { isUuid } from "@/features/storefront/catalog-evidence";
import { ApiError, customerApi } from "@/lib/api/client";
import type { CustomerOrderDetail, CustomerOrderItem } from "@/lib/api/types";
import { useApiQuery } from "@/lib/api/use-api-query";
import { AddressDisplay } from "./addresses";
import { DeliveryStepper } from "./delivery-stepper";
import { orderEvidence } from "./evidence";
import { AccountFrame } from "./frame";
import { ReviewModal } from "./review-modal";
import { ReturnModal } from "./return-modal";
import {
  AccountError,
  AccountLoading,
  AccountStatus,
  asAccountError,
  fieldError,
  useAccountCommand,
} from "./shared";

export function CustomerOrderDetailPage() {
  const params = useParams();
  const orderId = typeof params.id === "string" ? params.id : "";
  return (
    <AccountFrame
      title="Order details"
      description="Your purchase, with each seller's package tracked separately."
    >
      {(user) =>
        isUuid(orderId) ? (
          <OrderRead userId={user.id} orderId={orderId} />
        ) : (
          <AccountError message="This order link is invalid. Return to your order history." />
        )
      }
    </AccountFrame>
  );
}
function OrderRead({ userId, orderId }: { userId: string; orderId: string }) {
  const load = useCallback(
    async (signal: AbortSignal) =>
      orderEvidence(await customerApi.getOrder(orderId, signal), orderId),
    [orderId],
  );
  const query = useApiQuery(`${userId}:order:${orderId}`, load);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <Link href="/account/orders" className="sf-account-link">
        ← Back to orders
      </Link>
      {notice && <StorefrontNotice tone="success">{notice}</StorefrontNotice>}
      {query.kind === "loading" && (
        <AccountLoading label="Loading order details" />
      )}
      {query.kind === "error" && (
        <div data-testid="order-detail-error">
          <AccountError error={query.error} onRetry={query.retry} />
        </div>
      )}
      {query.kind === "ready" && (
        <OrderDetail
          order={query.data}
          onChanged={(message) => {
            setNotice(message);
            query.retry();
          }}
        />
      )}
    </>
  );
}
function OrderDetail({
  order,
  onChanged,
}: {
  order: CustomerOrderDetail;
  onChanged: (message: string) => void;
}) {
  const [review, setReview] = useState<CustomerOrderItem | null>(null);
  const [returnItem, setReturnItem] = useState<CustomerOrderItem | null>(null);
  const [cancel, setCancel] = useState(false);
  const canCancel =
    order.status === "pending" &&
    order.payment_status === "pending" &&
    order.packages.every((pkg) => pkg.status === "pending");
  return (
    <>
      <div className="sf-account-order-heading">
        <div>
          <h2 data-testid="order-detail-number">{order.order_number}</h2>
          <p>
            Placed <DateDisplay value={order.created_at} />
          </p>
        </div>
        <div>
          <AccountStatus status={order.status} testId="order-detail-status" />
          {canCancel && (
            <StorefrontButton
              variant="secondary"
              data-testid="cancel-order-button"
              onClick={() => setCancel(true)}
            >
              Cancel Order
            </StorefrontButton>
          )}
        </div>
      </div>
      <div className="sf-account-order-layout">
        <div>
          {order.packages.map((pkg) => (
            <section key={pkg.seller_order_id} className="sf-account-package">
              <h2>Package from: {pkg.seller_name}</h2>
              <DeliveryStepper
                status={pkg.status}
                carrier={pkg.carrier}
                trackingNumber={pkg.tracking_number}
                trackingEvents={pkg.tracking_events}
              />
              <ul className="sf-account-package-items">
                {pkg.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <h3>{item.product_title}</h3>
                      <p>{item.variant_name}</p>
                      <small>
                        SKU: {item.sku} · Qty: {item.quantity}
                      </small>
                    </div>
                    <div className="sf-account-line-total">
                      <Money
                        amount={item.total_price}
                        currency={order.currency}
                      />
                      <small>
                        <Money
                          amount={item.unit_price}
                          currency={order.currency}
                        />{" "}
                        each
                      </small>
                    </div>
                    <div className="sf-account-line-actions">
                      {item.can_review && (
                        <StorefrontButton
                          variant="secondary"
                          data-testid={`write-review-btn-${item.id}`}
                          onClick={() => setReview(item)}
                        >
                          Write Review
                        </StorefrontButton>
                      )}
                      {item.can_return && (
                        <StorefrontButton
                          variant="quiet"
                          data-testid={`request-return-btn-${item.id}`}
                          onClick={() => setReturnItem(item)}
                        >
                          Request Return
                        </StorefrontButton>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!order.packages.length && (
            <p className="sf-account-help">
              No package details are available for this order.
            </p>
          )}
        </div>
        <aside className="sf-account-receipt">
          <section>
            <h2>Payment summary</h2>
            <dl>
              {(
                [
                  ["Items subtotal", order.subtotal],
                  ["Shipping", order.shipping_total],
                  ["Discount", order.discount_total],
                ] as const
              ).map(([label, amount]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {label === "Discount" && /[1-9]/.test(amount) ? "−" : ""}
                    <Money amount={amount} currency={order.currency} />
                  </dd>
                </div>
              ))}
              <div className="sf-account-receipt-total">
                <dt>Total amount</dt>
                <dd data-testid="order-detail-total">
                  <Money amount={order.grand_total} currency={order.currency} />
                </dd>
              </div>
            </dl>
            <p>
              Payment status: <AccountStatus status={order.payment_status} />
            </p>
          </section>
          <section>
            <h2>Shipping destination</h2>
            {Object.keys(order.shipping_address).length ? (
              <AddressDisplay address={order.shipping_address} />
            ) : (
              <p>Address details unavailable.</p>
            )}
          </section>
        </aside>
      </div>
      {review && (
        <ReviewModal
          isOpen
          orderItemId={review.id}
          productTitle={review.product_title}
          onClose={() => setReview(null)}
          onSuccess={() =>
            onChanged("Review submitted. Publication depends on moderation.")
          }
        />
      )}
      {returnItem && (
        <ReturnModal
          isOpen
          orderItemId={returnItem.id}
          productTitle={returnItem.product_title}
          maxQuantity={returnItem.quantity}
          onClose={() => setReturnItem(null)}
          onSuccess={() =>
            onChanged(
              "Return request submitted. Approval and refunds are handled separately.",
            )
          }
        />
      )}
      {cancel && (
        <CancelDialog
          order={order}
          onClose={() => setCancel(false)}
          onAccepted={() => onChanged("Order cancelled.")}
        />
      )}
    </>
  );
}
function CancelDialog({
  order,
  onClose,
  onAccepted,
}: {
  order: CustomerOrderDetail;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const command = useAccountCommand();
  const [error, setError] = useState<ApiError | null>(null);
  const [reason, setReason] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    await command.run(
      async (signal) => {
        const updated = orderEvidence(
          await customerApi.cancelOrder(order.id, reason.trim(), signal),
          order.id,
        );
        if (updated.status !== "cancelled")
          throw new ApiError(
            "Cancellation was not confirmed. Reload this order before trying again.",
            0,
          );
        if (command.active()) onAccepted();
      },
      (failure) => setError(asAccountError(failure)),
    );
  }
  return (
    <StorefrontOverlay
      open
      title="Cancel this order?"
      description="Cancellation cannot be undone. The order must still be unpaid and eligible for cancellation."
      error={error?.message}
      busy={command.busy}
      onClose={onClose}
    >
      <form onSubmit={submit} data-testid="cancel-order-dialog">
        <StorefrontInput
          label="Reason for cancellation (optional)"
          name="reason"
          maxLength={255}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={fieldError(error, "reason")}
        />
        <div className="sf-account-actions">
          <StorefrontButton variant="secondary" onClick={onClose}>
            Keep order
          </StorefrontButton>
          <StorefrontButton
            type="submit"
            variant="danger"
            busy={command.busy}
            data-testid="confirm-cancel-button"
          >
            {command.busy ? "Cancelling..." : "Confirm Cancellation"}
          </StorefrontButton>
        </div>
      </form>
    </StorefrontOverlay>
  );
}
