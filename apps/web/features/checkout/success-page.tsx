"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StorefrontButton } from "@/components/storefront/controls";
import { Money } from "@/components/ui/displays";
import { useAuth } from "../auth/auth-provider";
import { useCheckoutSession } from "./session";
import { useOrderRead } from "./order-read";
import { orderIdFromQuery } from "./evidence";

export function CheckoutSuccessContent() {
  const id = orderIdFromQuery(useSearchParams());
  const { state, refresh } = useAuth();
  const { captured } = useCheckoutSession();
  const snapshot = captured?.id === id ? captured : null;
  const read = useOrderRead(id, Boolean(snapshot));
  if (!id)
    return (
      <div className="sf-checkout-state">
        <h2>No order reference found</h2>
        <p>Open confirmation from your completed payment or your orders.</p>
        <Link href="/cart" className="sf-button">
          Return to cart
        </Link>
      </div>
    );
  if (state.kind === "loading")
    return (
      <p className="sf-checkout-state" role="status">
        Checking your session…
      </p>
    );
  if (state.kind === "error")
    return (
      <div className="sf-checkout-state" role="alert">
        <h2>Your session could not be checked</h2>
        <StorefrontButton onClick={() => void refresh()}>
          Check session again
        </StorefrontButton>
      </div>
    );
  if (!snapshot && read.kind !== "ready")
    return (
      <div
        className="sf-checkout-state"
        role={read.kind === "error" ? "alert" : "status"}
      >
        {read.kind === "error" ? (
          <>
            <h2>Order status unavailable</h2>
            <p>{read.error}</p>
            <StorefrontButton onClick={read.retry}>
              Reload order status
            </StorefrontButton>
            {state.kind === "authenticated" && (
              <Link href="/account/orders">Check your orders</Link>
            )}
          </>
        ) : (
          "Loading order status…"
        )}
      </div>
    );
  const order = snapshot ?? read.order;
  if (!order) return null;
  const paid = order.paymentStatus === "paid";
  return (
    <section className="sf-checkout-receipt" aria-labelledby="receipt-heading">
      <p className="sf-eyebrow">{paid ? "Payment accepted" : "Order status"}</p>
      <h2 id="receipt-heading">
        {paid
          ? "Thank you. Your order is confirmed."
          : "Your payment is not confirmed."}
      </h2>
      <p>
        {paid
          ? "Each seller will prepare their part of your order. Shipment updates will appear in your order details."
          : "Check the current payment status before trying again. This page does not indicate a successful charge."}
      </p>
      <dl>
        <div>
          <dt>Order reference</dt>
          <dd data-testid="success-order-number">{order.number}</dd>
        </div>
        <div>
          <dt>Payment status</dt>
          <dd>{order.paymentStatus.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>{paid ? "Amount paid" : "Order total"}</dt>
          <dd>
            <Money amount={order.amount} currency={order.currency} />
          </dd>
        </div>
      </dl>
      <div className="sf-checkout-receipt-actions">
        {state.kind === "authenticated" && (
          <Link
            className="sf-button"
            data-variant="primary"
            href={`/account/orders/${order.id}`}
          >
            View your order
          </Link>
        )}
        {order.paymentStatus === "pending" &&
          !order.cancelled &&
          !order.processing && (
            <Link
              className="sf-button"
              data-variant="primary"
              href={`/checkout/pay?order_id=${order.id}`}
            >
              Continue to payment
            </Link>
          )}
        <Link className="sf-button" data-variant="secondary" href="/search">
          Continue shopping
        </Link>
      </div>
      {state.kind === "anonymous" && (
        <p className="sf-checkout-note">
          Keep this order reference. Guest payment details are available in this
          browser session, including after a reload. A different browser or an
          expired session cannot use this reference to access the order.
        </p>
      )}
    </section>
  );
}
