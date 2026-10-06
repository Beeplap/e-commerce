"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  StorefrontButton,
  StorefrontInput,
} from "@/components/storefront/controls";
import { Money } from "@/components/ui/displays";
import { ApiError, checkoutApi, errorMessage } from "@/lib/api/client";
import type { CheckoutQuote, CustomerAddress } from "@/lib/api/types";
import { useAuth } from "../auth/auth-provider";
import { useCart } from "../cart/cart-context";
import {
  AddressFields,
  addressErrors,
  emptyAddress,
  type Address,
} from "./address-fields";
import { addressesEvidence, placedEvidence, quoteEvidence } from "./evidence";
import { useCheckoutSession } from "./session";
import { CheckoutSummary } from "./summary";

export function CheckoutContent() {
  const { state, refresh } = useAuth();
  if (state.kind === "loading")
    return (
      <div className="sf-checkout-state" role="status">
        Checking your session…
      </div>
    );
  if (state.kind === "error")
    return (
      <div className="sf-checkout-state" role="alert">
        <h2>Your session could not be checked</h2>
        <p>{errorMessage(state.error)}</p>
        <StorefrontButton onClick={() => void refresh()}>
          Check session again
        </StorefrontButton>
      </div>
    );
  return (
    <CheckoutForm
      key={state.kind === "authenticated" ? state.user.id : "guest"}
      email={state.kind === "authenticated" ? state.user.email : null}
    />
  );
}
function CheckoutForm({ email: accountEmail }: { email: string | null }) {
  const {
    cart,
    status,
    error: cartError,
    isLoading,
    revision,
    refreshCart,
  } = useCart();
  const router = useRouter();
  const { rememberPlacement } = useCheckoutSession();
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [saved, setSaved] = useState<{
    kind: "loading" | "ready" | "error";
    items: CustomerAddress[];
    error?: string;
  }>({ kind: accountEmail ? "loading" : "ready", items: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState(!accountEmail);
  const [addressAttempt, setAddressAttempt] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [read, setRead] = useState<{
    key: string;
    kind: "loading" | "ready" | "error";
    quote: CheckoutQuote | null;
    error?: string;
  } | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false),
    alive = useRef(true),
    form = useRef<HTMLFormElement>(null);
  const alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submitError) alert.current?.focus();
  }, [submitError]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!accountEmail) return;
    const controller = new AbortController();
    const load = async () => {
      setSaved({ kind: "loading", items: [] });
      setSelected(null);
      try {
        const items = addressesEvidence(
          await checkoutApi.addresses(controller.signal),
        );
        if (controller.signal.aborted) return;
        setSaved({ kind: "ready", items });
        if (!items.length) setNewAddress(true);
        else
          setSelected(
            (items.find((item) => item.is_default) ?? items[0])?.id ?? null,
          );
      } catch (error: unknown) {
        if (!controller.signal.aborted)
          setSaved({ kind: "error", items: [], error: errorMessage(error) });
      }
    };
    void load();
    return () => controller.abort();
  }, [accountEmail, addressAttempt]);
  const chosenAddress = !newAddress
    ? saved.items.find((item) => item.id === selected)
    : null;
  const complete = Boolean(
    chosenAddress ||
    (newAddress && Object.keys(addressErrors(address)).length === 0),
  );
  const payload = chosenAddress
    ? { address_id: chosenAddress.id, shipping_selections: selections }
    : {
        shipping_address: Object.fromEntries(
          Object.entries(address).map(([key, value]) => [key, value.trim()]),
        ),
        shipping_selections: selections,
      };
  const key = JSON.stringify([
    revision,
    status,
    isLoading,
    complete ? payload : null,
  ]);
  const activeKey = useRef(key);
  useEffect(() => {
    activeKey.current = key;
  }, [key]);
  useEffect(() => {
    if (!cart || status !== "ready" || isLoading || !complete) return;
    const controller = new AbortController();
    const load = async () => {
      setRead({ key, kind: "loading", quote: null });
      try {
        const quote = quoteEvidence(
          await checkoutApi.quote(JSON.parse(key)[3], controller.signal),
          cart,
          selections,
        );
        if (!controller.signal.aborted) setRead({ key, kind: "ready", quote });
      } catch (error: unknown) {
        if (!controller.signal.aborted)
          setRead({
            key,
            kind: "error",
            quote: null,
            error: errorMessage(error),
          });
      }
    };
    const timer = window.setTimeout(() => void load(), 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, quoteAttempt, cart, status, isLoading, complete, selections]);
  const current = read?.key === key ? read : null;
  const quote = current?.kind === "ready" ? current.quote : null;
  const unavailable =
    quote?.sellers.some((seller) =>
      seller.items.some((item) => !item.is_in_stock),
    ) || cart?.has_out_of_stock_items;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || uncertain) return;
    const invalid = newAddress ? addressErrors(address) : {};
    if (
      !accountEmail &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        email.trim().length > 254)
    )
      invalid.email = "Enter a valid email address.";
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus(),
      );
      return;
    }
    if (!quote || isLoading || unavailable) {
      setSubmitError(
        "Review a current delivery quote and resolve stock issues before placing your order.",
      );
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const submittedKey = key;
    let received = false;
    try {
      const result = await checkoutApi.placeOrder({
        ...payload,
        ...(!accountEmail ? { customer_email: email.trim() } : {}),
      });
      received = true;
      const order = placedEvidence(result);
      if (!alive.current) return;
      setUncertain(true);
      rememberPlacement(order);
      router.push(`/checkout/pay?order_id=${order.id}`);
      // A later cart read must never turn an accepted order into a retry.
      try {
        await refreshCart();
      } catch (error: unknown) {
        if (alive.current)
          setSubmitError(
            `Your order was placed. The cart could not be refreshed: ${errorMessage(error)}`,
          );
      }
    } catch (error: unknown) {
      if (!alive.current) return;
      if (
        received ||
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500
      ) {
        setUncertain(true);
        setSubmitError(
          "We could not verify whether the order was placed. Check your orders before submitting again. If you checked out as a guest, keep this browser session and contact support with what happened.",
        );
      } else {
        setSubmitError(errorMessage(error));
        const emailErrors = error.fields.customer_email;
        if (emailErrors)
          setErrors((previous) => ({
            ...previous,
            email: emailErrors.join(" "),
          }));
      }
    } finally {
      if (alive.current) {
        inFlight.current = false;
        setSubmitting(false);
        if (submittedKey !== activeKey.current)
          setQuoteAttempt((value) => value + 1);
      }
    }
  };
  if (status === "loading")
    return (
      <div className="sf-checkout-state" role="status">
        Loading your cart…
      </div>
    );
  if (status === "error" || !cart)
    return (
      <div className="sf-checkout-state" role="alert">
        <h2>Your cart could not be loaded</h2>
        <p>{cartError ?? "Please reload your cart before continuing."}</p>
        <StorefrontButton onClick={() => void refreshCart()}>
          Reload cart
        </StorefrontButton>
        <Link href="/cart">Return to cart</Link>
      </div>
    );
  if (!cart.total_items)
    return (
      <div className="sf-checkout-state">
        <h2>Your cart is empty</h2>
        <p>Choose something you love before heading to checkout.</p>
        <Link className="sf-button" data-variant="primary" href="/search">
          Explore the shop
        </Link>
      </div>
    );
  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      className="sf-checkout-layout"
      aria-label="Checkout"
      aria-busy={submitting || undefined}
    >
      <div className="sf-checkout-details">
        <fieldset disabled={submitting || uncertain}>
          <legend className="sr-only">Checkout details</legend>
          <section
            className="sf-checkout-section"
            aria-labelledby="checkout-contact"
          >
            <div className="sf-checkout-section-heading">
              <span aria-hidden="true">01</span>
              <h2 id="checkout-contact">Contact</h2>
            </div>
            {accountEmail ? (
              <p>
                Signed in as <strong>{accountEmail}</strong>
              </p>
            ) : (
              <>
                <StorefrontInput
                  id="checkout-email"
                  label="Email address"
                  name="customer_email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  onBlur={() => {
                    if (
                      email &&
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                    )
                      setErrors((previous) => ({
                        ...previous,
                        email: "Enter a valid email address.",
                      }));
                  }}
                  required
                  value={email}
                  error={errors.email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((previous) => ({ ...previous, email: "" }));
                  }}
                  hint="Use the email address you want associated with this order."
                />
                <p className="sf-checkout-note">
                  Already have an account?{" "}
                  <Link href="/login?next=%2Fcheckout">Sign in</Link> or
                  continue as a guest.
                </p>
              </>
            )}
          </section>
          <section
            className="sf-checkout-section"
            aria-labelledby="checkout-address"
          >
            <div className="sf-checkout-section-heading">
              <span aria-hidden="true">02</span>
              <h2 id="checkout-address">Shipping address</h2>
            </div>
            {accountEmail && (
              <>
                <div className="sf-checkout-address-toolbar">
                  <p>Choose a saved address or enter a new one.</p>
                  <StorefrontButton
                    variant="quiet"
                    onClick={() => setNewAddress((value) => !value)}
                  >
                    {newAddress
                      ? "Choose a saved address"
                      : "Use a new address"}
                  </StorefrontButton>
                </div>
                {!newAddress && saved.kind === "loading" && (
                  <p role="status">Loading saved addresses…</p>
                )}
                {!newAddress && saved.kind === "error" && (
                  <div role="alert" className="sf-checkout-alert">
                    <p>{saved.error}</p>
                    <StorefrontButton
                      variant="secondary"
                      onClick={() => setAddressAttempt((value) => value + 1)}
                    >
                      Retry saved addresses
                    </StorefrontButton>
                    <StorefrontButton
                      variant="quiet"
                      onClick={() => setNewAddress(true)}
                    >
                      Use a new address
                    </StorefrontButton>
                  </div>
                )}
                {!newAddress && saved.kind === "ready" && (
                  <div className="sf-checkout-addresses">
                    {saved.items.map((item) => (
                      <label className="sf-checkout-address" key={item.id}>
                        <input
                          type="radio"
                          name="saved_address"
                          value={item.id}
                          checked={selected === item.id}
                          onChange={() => setSelected(item.id)}
                        />
                        <span>
                          <strong>{item.full_name}</strong>
                          {item.is_default && <small>DEFAULT</small>}
                          <span>{item.line1}</span>
                          {item.line2 && <span>{item.line2}</span>}
                          <span>
                            {item.city}, {item.state} {item.postal_code}
                          </span>
                          <span>
                            {item.country} · {item.phone}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
            {newAddress && (
              <AddressFields
                value={address}
                errors={errors}
                onBlur={(field) =>
                  setErrors((previous) => ({
                    ...previous,
                    [field]: addressErrors(address)[field] ?? "",
                  }))
                }
                onChange={(field, value) => {
                  setAddress((previous) => ({ ...previous, [field]: value }));
                  setErrors((previous) => ({ ...previous, [field]: "" }));
                }}
              />
            )}
          </section>
          <section
            className="sf-checkout-section"
            aria-labelledby="checkout-delivery"
          >
            <div className="sf-checkout-section-heading">
              <span aria-hidden="true">03</span>
              <h2 id="checkout-delivery">Delivery</h2>
            </div>
            <p className="sf-checkout-note">
              Each seller ships their part of your order. Delivery windows are
              estimates.
            </p>
            {!complete && (
              <p className="sf-checkout-placeholder">
                Complete your shipping address to see delivery options and the
                order total.
              </p>
            )}
            {complete && (!current || current.kind === "loading") && (
              <p className="sf-checkout-placeholder" role="status">
                Updating delivery and order total…
              </p>
            )}
            {current?.kind === "error" && (
              <div className="sf-checkout-alert" role="alert">
                <p>{current.error}</p>
                <StorefrontButton
                  variant="secondary"
                  onClick={() => setQuoteAttempt((value) => value + 1)}
                >
                  Refresh quote
                </StorefrontButton>
              </div>
            )}
            {quote?.sellers.map((seller) => (
              <fieldset className="sf-checkout-delivery" key={seller.seller_id}>
                <legend>Seller: {seller.seller_name}</legend>
                {seller.available_shipping_methods.map((method) => (
                  <label
                    key={method.method_id}
                    htmlFor={`delivery-${seller.seller_id}-${method.method_id}`}
                  >
                    <input
                      id={`delivery-${seller.seller_id}-${method.method_id}`}
                      type="radio"
                      name={`delivery-${seller.seller_id}`}
                      checked={
                        seller.selected_shipping_method?.method_id ===
                        method.method_id
                      }
                      onChange={() =>
                        setSelections((previous) => ({
                          ...previous,
                          [seller.seller_id]: method.method_id,
                        }))
                      }
                    />
                    <span>
                      <strong>{method.name}</strong>
                      <span>
                        {method.carrier} · Estimated {method.min_days}–
                        {method.max_days} days
                      </span>
                    </span>
                    <Money amount={method.rate} currency={quote.currency} />
                  </label>
                ))}
              </fieldset>
            ))}
          </section>
        </fieldset>
        <Link className="sf-checkout-back" href="/cart">
          ← Return to cart
        </Link>
      </div>
      <CheckoutSummary cart={cart} quote={quote}>
        {unavailable && (
          <p className="sf-checkout-alert" role="alert">
            Some items do not have enough stock.{" "}
            <Link href="/cart">Update your cart</Link> before placing the order.
          </p>
        )}
        {submitError && (
          <div
            ref={alert}
            className="sf-checkout-alert"
            role="alert"
            tabIndex={-1}
          >
            <p>{submitError}</p>
            {uncertain && accountEmail && (
              <Link href="/account/orders">Check your orders</Link>
            )}
          </div>
        )}
        <StorefrontButton
          type="submit"
          className="sf-checkout-submit"
          busy={submitting}
          disabled={uncertain || isLoading || !quote || Boolean(unavailable)}
        >
          {submitting ? "Placing your order…" : "Confirm & place order"}
        </StorefrontButton>
      </CheckoutSummary>
    </form>
  );
}
