"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StorefrontButton } from "@/components/storefront/controls";
import { useAuth } from "../auth/auth-provider";
import { useCheckoutSession } from "./session";
import { useOrderRead } from "./order-read";
import { orderIdFromQuery } from "./evidence";
import { PaymentForm } from "./payment-form";

export function CheckoutPayContent() {
  const query = useSearchParams(),
    router = useRouter();
  const id = orderIdFromQuery(query);
  const { state, refresh } = useAuth();
  const { placed, captured, rememberCapture } = useCheckoutSession();
  const snapshot =
    captured?.id === id ? captured : placed?.id === id ? placed : null;
  const read = useOrderRead(id, Boolean(snapshot));
  if (!id)
    return (
      <div className="sf-checkout-state">
        <h2>No pending order found</h2>
        <p>Open payment from a placed order with a valid order reference.</p>
        <Link className="sf-button" data-variant="primary" href="/cart">
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
        <p>Payment requires your current browser session.</p>
        <StorefrontButton onClick={() => void refresh()}>
          Check session again
        </StorefrontButton>
      </div>
    );
  if (!snapshot && state.kind === "authenticated" && read.kind !== "ready")
    return (
      <div
        className="sf-checkout-state"
        role={read.kind === "error" ? "alert" : "status"}
      >
        {read.kind === "error" ? (
          <>
            <h2>Order details unavailable</h2>
            <p>{read.error}</p>
            <StorefrontButton onClick={read.retry}>
              Reload order
            </StorefrontButton>
            <Link href="/account/orders">Check your orders</Link>
          </>
        ) : (
          "Loading your order…"
        )}
      </div>
    );
  const order =
    snapshot ?? (state.kind === "authenticated" ? read.order : null);
  if (order && order.paymentStatus !== "pending")
    return (
      <div className="sf-checkout-state">
        <h2>
          {order.paymentStatus === "paid"
            ? "This order is already paid"
            : "This order is not awaiting payment"}
        </h2>
        <p>No further payment will be requested here.</p>
        <Link
          className="sf-button"
          data-variant="primary"
          href={`/checkout/success?order_id=${id}`}
        >
          View order status
        </Link>
      </div>
    );
  return (
    <div className="sf-checkout-payment-layout">
      <PaymentForm
        key={`${state.kind === "authenticated" ? state.user.id : "guest"}:${id}`}
        orderId={id}
        orderNumber={order?.number}
        total={order?.amount}
        currency={order?.currency}
        onCaptured={(payment) => {
          rememberCapture({
            id: payment.order_id,
            number: payment.order_number,
            amount: payment.amount,
            currency: payment.currency,
            paymentStatus: "paid",
          });
          router.push(`/checkout/success?order_id=${payment.order_id}`);
        }}
      />
      <aside className="sf-checkout-payment-note">
        <h2>One order, separate shipments</h2>
        <p>
          Each seller prepares their portion after payment is accepted. Check
          your order for shipment updates.
        </p>
        <p>Use the same browser session to finish a guest payment.</p>
        <Link
          href={state.kind === "authenticated" ? "/account/orders" : "/cart"}
        >
          {state.kind === "authenticated"
            ? "Check your orders"
            : "Return to cart"}{" "}
          →
        </Link>
      </aside>
    </div>
  );
}
