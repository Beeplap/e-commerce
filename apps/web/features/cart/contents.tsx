"use client";
import Link from "next/link";
import { Money } from "@/components/ui/displays";
import { StorefrontButton } from "@/components/storefront/controls";
import { StorefrontSkeleton } from "@/components/storefront/content";
import { useCart } from "./cart-context";
import { CouponPreview } from "./coupon-preview";
import { CartThumbnail } from "./thumbnail";
import type { CartActions } from "./actions";

export function CartContents({
  actions: { feedback, pending, bindFeedback, run },
  compact = false,
  onNavigate,
}: {
  actions: CartActions;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const {
    cart,
    status,
    error,
    isLoading,
    updateQuantity,
    removeItem,
    clearCart,
    refreshCart,
    revision,
  } = useCart();
  const checkoutBlocked =
    isLoading || cart?.has_out_of_stock_items || feedback?.kind === "error";
  const reload = () => {
    void run("reload", refreshCart, "");
  };
  return (
    <div className={`sf-cart-content${compact ? " sf-cart-compact" : ""}`}>
      <div className="sf-cart-feedback" aria-live="polite">
        {feedback && (
          <p
            ref={bindFeedback}
            tabIndex={-1}
            role={feedback.kind === "error" ? "alert" : "status"}
            className={
              feedback.kind === "error" ? "sf-cart-error" : "sf-cart-confirmed"
            }
          >
            {feedback.message}
          </p>
        )}
        {feedback?.kind === "error" && status === "ready" && (
          <StorefrontButton
            variant="quiet"
            disabled={isLoading}
            onClick={reload}
          >
            Reload cart
          </StorefrontButton>
        )}
      </div>
      {status === "loading" ? (
        <div className="sf-cart-recovery" aria-busy="true">
          <p role="status">Loading your cart…</p>
          <div className="sf-cart-loading" aria-hidden="true">
            <StorefrontSkeleton />
            <StorefrontSkeleton />
            <StorefrontSkeleton />
          </div>
        </div>
      ) : status === "error" || !cart ? (
        <div className="sf-cart-recovery">
          <p className="sf-cart-eyebrow">Cart unavailable</p>
          <h2>We couldn’t load your cart</h2>
          <p role="alert">
            {error || "Cart information is unavailable. Try again."}
          </p>
          <StorefrontButton busy={isLoading} onClick={reload}>
            Try again
          </StorefrontButton>
          <Link
            href="/search"
            onClick={onNavigate}
            className="sf-cart-text-link"
          >
            Continue shopping ↗
          </Link>
        </div>
      ) : !cart.sellers.length ? (
        <div className="sf-cart-recovery sf-cart-empty">
          <p className="sf-cart-eyebrow">A little room for discovery</p>
          <h2>Your cart is currently empty</h2>
          <p>
            Find something you love from independent sellers. Your selections
            will appear here, grouped by store.
          </p>
          <Link
            href="/search"
            onClick={onNavigate}
            className="sf-cart-primary-link"
          >
            Explore the shop <span aria-hidden="true">↗</span>
          </Link>
        </div>
      ) : (
        <>
          <div className="sf-cart-toolbar">
            <p>
              {cart.total_items} {cart.total_items === 1 ? "item" : "items"} ·{" "}
              {cart.sellers.length}{" "}
              {cart.sellers.length === 1 ? "seller" : "sellers"}
            </p>
            {!compact && (
              <StorefrontButton
                variant="quiet"
                busy={pending === "clear"}
                disabled={isLoading}
                onClick={(event) => {
                  void run(
                    "clear",
                    clearCart,
                    "Cart cleared.",
                    event.currentTarget,
                  );
                }}
              >
                {pending === "clear" ? "Clearing…" : "Clear Entire Cart"}
              </StorefrontButton>
            )}
          </div>
          {cart.has_out_of_stock_items && (
            <div className="sf-cart-stock-alert" role="alert">
              <strong>Checkout is disabled</strong>
              <p>
                Adjust quantities or remove unavailable items before continuing.
                Stock is checked again at checkout.
              </p>
            </div>
          )}
          <div className="sf-cart-layout">
            <div className="sf-cart-groups">
              {cart.sellers.map((seller) => (
                <section
                  className="sf-cart-seller"
                  key={seller.seller_id}
                  aria-label={`Items from ${seller.seller_name}`}
                >
                  <header>
                    <div>
                      <p className="sf-cart-eyebrow">Sold by</p>
                      <h2>
                        <Link
                          href={`/sellers/${seller.seller_id}`}
                          onClick={onNavigate}
                        >
                          {seller.seller_name}
                        </Link>
                      </h2>
                    </div>
                    <p className="sf-cart-seller-total">
                      <span>Seller subtotal</span>
                      <Money
                        amount={seller.subtotal}
                        currency={cart.currency}
                      />
                    </p>
                  </header>
                  <ul>
                    {seller.items.map((item) => (
                      <li
                        key={item.id}
                        className="sf-cart-item"
                        aria-busy={pending === item.id || undefined}
                      >
                        <Link
                          href={`/products/${item.product_id}`}
                          onClick={onNavigate}
                          className="sf-cart-image"
                          aria-label={`View ${item.product_title}`}
                        >
                          <CartThumbnail
                            url={item.thumbnail_url}
                            title={item.product_title}
                          />
                        </Link>
                        <div className="sf-cart-item-detail">
                          <h3>
                            <Link
                              href={`/products/${item.product_id}`}
                              onClick={onNavigate}
                            >
                              {item.product_title}
                            </Link>
                          </h3>
                          <p className="sf-cart-variant">
                            {item.variant_name === item.sku
                              ? `SKU: ${item.sku}`
                              : item.variant_name}
                          </p>
                          {item.variant_name !== item.sku && (
                            <p className="sf-cart-sku">SKU: {item.sku}</p>
                          )}
                          <p className="sf-cart-unit">
                            <Money
                              amount={item.unit_price}
                              currency={cart.currency}
                            />{" "}
                            each
                          </p>
                          <p
                            className="sf-cart-availability"
                            data-unavailable={!item.is_available}
                          >
                            {item.stock_warning ||
                              (item.is_available
                                ? `In stock · ${item.available_stock} available`
                                : "Unavailable")}
                          </p>
                        </div>
                        <div className="sf-cart-line-total">
                          <span>Line subtotal</span>
                          <Money
                            amount={item.line_subtotal}
                            currency={cart.currency}
                          />
                        </div>
                        <div className="sf-cart-item-actions">
                          <div
                            className="sf-cart-quantity"
                            role="group"
                            aria-label={`Quantity for ${item.product_title}`}
                          >
                            <StorefrontButton
                              variant="quiet"
                              aria-label="Decrease quantity"
                              disabled={isLoading || item.quantity <= 1}
                              onClick={(event) => {
                                void run(
                                  item.id,
                                  () =>
                                    updateQuantity(item.id, item.quantity - 1),
                                  `Quantity updated for ${item.product_title}.`,
                                  event.currentTarget,
                                );
                              }}
                            >
                              −
                            </StorefrontButton>
                            <output
                              aria-label={`Quantity for ${item.product_title}`}
                              data-testid={`cart-${compact ? "drawer" : "page"}-qty-${item.id}`}
                            >
                              {item.quantity}
                            </output>
                            <StorefrontButton
                              variant="quiet"
                              aria-label="Increase quantity"
                              disabled={
                                isLoading ||
                                item.quantity >= item.available_stock
                              }
                              onClick={(event) => {
                                void run(
                                  item.id,
                                  () =>
                                    updateQuantity(item.id, item.quantity + 1),
                                  `Quantity updated for ${item.product_title}.`,
                                  event.currentTarget,
                                );
                              }}
                            >
                              +
                            </StorefrontButton>
                          </div>
                          <StorefrontButton
                            variant="quiet"
                            disabled={isLoading}
                            aria-label={`Remove ${item.product_title}`}
                            onClick={(event) => {
                              void run(
                                item.id,
                                () => removeItem(item.id),
                                `${item.product_title} removed.`,
                                event.currentTarget,
                              );
                            }}
                          >
                            Remove
                          </StorefrontButton>
                          {pending === item.id && (
                            <span role="status">Updating…</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!compact && (
                <Link href="/search" className="sf-cart-text-link">
                  Continue shopping <span aria-hidden="true">↗</span>
                </Link>
              )}
            </div>
            <aside className="sf-cart-summary" aria-label="Cart summary">
              <h2>{compact ? "Your subtotal" : "Order summary"}</h2>
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd
                    data-testid={`cart-${compact ? "drawer" : "summary"}-subtotal`}
                  >
                    <Money amount={cart.subtotal} currency={cart.currency} />
                  </dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd>Calculated at checkout</dd>
                </div>
                <div>
                  <dt>Taxes and discounts</dt>
                  <dd>Determined at checkout</dd>
                </div>
                <div className="sf-cart-items-total">
                  <dt>Items total</dt>
                  <dd data-testid="cart-summary-total">
                    <Money amount={cart.subtotal} currency={cart.currency} />
                  </dd>
                </div>
              </dl>
              <p className="sf-cart-note">
                This is your items subtotal. Final charges are confirmed at
                checkout.
              </p>
              {checkoutBlocked ? (
                <button
                  className="sf-cart-primary-link"
                  type="button"
                  disabled
                  aria-disabled="true"
                >
                  Proceed to Checkout
                </button>
              ) : (
                <Link
                  href="/checkout"
                  onClick={onNavigate}
                  className="sf-cart-primary-link"
                >
                  Proceed to Checkout <span aria-hidden="true">↗</span>
                </Link>
              )}
              {compact && (
                <Link
                  href="/cart"
                  onClick={onNavigate}
                  className="sf-cart-text-link"
                >
                  View Full Cart
                </Link>
              )}
              {!compact && (
                <CouponPreview
                  key={revision}
                  subtotal={cart.subtotal}
                  currency={cart.currency}
                  busy={isLoading}
                />
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
