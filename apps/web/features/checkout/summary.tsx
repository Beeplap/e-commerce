import type { ReactNode } from "react";
import type { CartResponse, CheckoutQuote } from "@/lib/api/types";
import { Money } from "@/components/ui/displays";
import { CartThumbnail } from "../cart/thumbnail";
export function CheckoutSummary({
  cart,
  quote,
  children,
}: {
  cart: CartResponse;
  quote: CheckoutQuote | null;
  children: ReactNode;
}) {
  return (
    <aside
      className="sf-checkout-summary"
      aria-labelledby="checkout-summary-heading"
    >
      <div className="sf-checkout-summary-top">
        <h2 id="checkout-summary-heading">Your order</h2>
        <p>
          {cart.total_items} {cart.total_items === 1 ? "item" : "items"} ·{" "}
          {cart.sellers.length}{" "}
          {cart.sellers.length === 1 ? "seller" : "sellers"}
        </p>
      </div>
      <div className="sf-checkout-summary-items">
        {cart.sellers.map((seller) => (
          <section
            key={seller.seller_id}
            className="sf-checkout-summary-seller"
            aria-label={`Items from ${seller.seller_name}`}
          >
            <h3>{seller.seller_name}</h3>
            {seller.items.map((item) => {
              const current = quote?.sellers
                .find((entry) => entry.seller_id === seller.seller_id)
                ?.items.find((entry) => entry.item_id === item.id);
              return (
                <div
                  className="sf-checkout-summary-item"
                  data-long-amount={
                    (current?.line_subtotal ?? item.line_subtotal).length >
                      16 || undefined
                  }
                  key={item.id}
                >
                  <CartThumbnail
                    url={item.thumbnail_url}
                    title={item.product_title}
                  />
                  <div>
                    <p>{current?.product_title ?? item.product_title}</p>
                    <span>
                      {item.variant_name} · Qty {item.quantity}
                    </span>
                    {current?.is_in_stock === false && (
                      <p className="sf-checkout-stock-error">
                        Not enough stock. Update your cart.
                      </p>
                    )}
                  </div>
                  <Money
                    amount={current?.line_subtotal ?? item.line_subtotal}
                    currency={quote?.currency ?? cart.currency}
                  />
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <dl className="sf-checkout-totals">
        <div>
          <dt>{quote ? "Subtotal" : "Cart subtotal"}</dt>
          <dd data-testid="checkout-summary-subtotal">
            <Money
              amount={quote?.subtotal ?? cart.subtotal}
              currency={quote?.currency ?? cart.currency}
            />
          </dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd data-testid="checkout-summary-shipping">
            {quote ? (
              <Money amount={quote.shipping_total} currency={quote.currency} />
            ) : (
              "Awaiting address"
            )}
          </dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>
            {quote ? (
              <Money amount={quote.tax_total} currency={quote.currency} />
            ) : (
              "Calculated in review"
            )}
          </dd>
        </div>
        {quote && !/^0(?:\.0+)?$/.test(quote.discount_total) && (
          <div>
            <dt>Discount</dt>
            <dd>
              −<Money amount={quote.discount_total} currency={quote.currency} />
            </dd>
          </div>
        )}
        <div className="sf-checkout-total">
          <dt>Order total</dt>
          <dd data-testid="checkout-summary-total">
            {quote ? (
              <Money amount={quote.grand_total} currency={quote.currency} />
            ) : (
              "Not quoted yet"
            )}
          </dd>
        </div>
      </dl>
      <div className="sf-checkout-summary-action">
        {children}
        <p className="sf-checkout-note">
          Review your payment amount next. Placing the order does not charge
          your card.
        </p>
      </div>
    </aside>
  );
}
